import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '$env/static/private';
import twilio from 'twilio';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Check if we should only log to console instead of actually sending
const SMS_CONSOLE_ONLY = process.env.SMS_CONSOLE_ONLY === 'true';

export interface SendSMSOptions {
	to: string;
	message: string;
	bypassDevMode?: boolean; // Allow override for specific use cases
}

export interface SendSMSResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

export interface BulkSMSOptions {
	recipients: string[];
	message: string;
	adminPhone?: string; // In dev mode, only send to this number
}

export interface PersonalizedSMSOptions {
	messages: Array<{ phone: string; message: string }>;
	adminPhone?: string; // In dev mode, only send to this number
}

/**
 * Normalize phone number to E.164 format (+1234567890)
 * Handles common US formats: 6145551234, (614) 555-1234, 614-555-1234
 */
function normalizePhoneNumber(phone: string): string {
	// Remove all non-digit characters
	const digitsOnly = phone.replace(/\D/g, '');

	// If it already starts with +, return as is
	if (phone.startsWith('+')) {
		return phone;
	}

	// If it's 10 digits, assume US and add +1
	if (digitsOnly.length === 10) {
		return `+1${digitsOnly}`;
	}

	// If it's 11 digits starting with 1, add +
	if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
		return `+${digitsOnly}`;
	}

	// Return as is and let validation catch it
	return phone;
}

/**
 * Check if we're in development mode
 */
function isDevelopmentMode(): boolean {
	return process.env.NODE_ENV !== 'production';
}

/**
 * Filter recipients based on development mode
 * In dev mode, only sends to adminPhone if provided
 */
function filterRecipientsForDevMode(recipients: string[], adminPhone?: string): string[] {
	if (!isDevelopmentMode()) {
		return recipients; // Production: send to all
	}

	if (!adminPhone) {
		console.warn('🧪 Development mode: No admin phone provided, no SMS will be sent');
		return [];
	}

	// Normalize all phone numbers for comparison
	const normalizedAdmin = normalizePhoneNumber(adminPhone);
	const normalizedRecipients = recipients.map(r => normalizePhoneNumber(r));

	if (normalizedRecipients.includes(normalizedAdmin)) {
		console.log('🧪 Development mode: Only sending SMS to admin user:', normalizedAdmin);
		return [normalizedAdmin];
	}

	console.warn('🧪 Development mode: Admin phone not in recipient list, no SMS will be sent');
	console.warn('   Admin phone:', normalizedAdmin);
	console.warn('   Recipients:', normalizedRecipients);
	return [];
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
	try {
		const { to, message, bypassDevMode = false } = options;

		// Normalize phone number
		const normalizedPhone = normalizePhoneNumber(to);

		// Validate phone number format (basic check)
		if (!normalizedPhone || !normalizedPhone.startsWith('+')) {
			console.error('Invalid phone number format:', to, '→', normalizedPhone);
			return {
				success: false,
				error: 'Phone number must be in E.164 format (e.g., +16145551234)'
			};
		}

		// Development mode protection (unless bypassed)
		if (!bypassDevMode && isDevelopmentMode()) {
			console.log('🧪 Development mode: SMS not sent (use bypassDevMode to override)');
			return {
				success: true,
				messageId: 'dev-mode-blocked'
			};
		}

		// Console-only mode: Just log instead of sending
		if (SMS_CONSOLE_ONLY) {
			console.log('📋 CONSOLE-ONLY MODE - Would send SMS:');
			console.log(`   To: ${normalizedPhone}`);
			console.log(`   From: ${TWILIO_PHONE_NUMBER}`);
			console.log(`   Message: ${message}`);
			console.log('   (Set SMS_CONSOLE_ONLY=false in .env to actually send)');
			return {
				success: true,
				messageId: 'console-only-mock-' + Date.now()
			};
		}

		// Send the message
		console.log(`📱 Sending SMS to ${normalizedPhone} (from: ${TWILIO_PHONE_NUMBER})`);
		const result = await client.messages.create({
			body: message,
			from: TWILIO_PHONE_NUMBER,
			to: normalizedPhone
		});

		console.log(`✅ SMS sent successfully! SID: ${result.sid}`);

		return {
			success: true,
			messageId: result.sid
		};
	} catch (error) {
		console.error('❌ Failed to send SMS:', error);
		if (error instanceof Error) {
			console.error('Error details:', error.message);
			console.error('Error stack:', error.stack);
		}
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Send SMS to multiple recipients
 * In development mode, only sends to adminPhone
 */
export async function sendBulkSMS(options: BulkSMSOptions): Promise<{
	sent: number;
	failed: number;
	skipped: number;
	errors: Array<{ phone: string; error: string }>;
	devMode: boolean;
}> {
	const { recipients, message, adminPhone } = options;

	// Filter recipients based on dev mode
	const filteredRecipients = filterRecipientsForDevMode(recipients, adminPhone);
	const skippedCount = recipients.length - filteredRecipients.length;
	const devMode = isDevelopmentMode();

	if (devMode && skippedCount > 0) {
		console.log(`🧪 Development mode: Skipped ${skippedCount} recipient(s)`);
	}

	const results = {
		sent: 0,
		failed: 0,
		skipped: skippedCount,
		errors: [] as Array<{ phone: string; error: string }>,
		devMode
	};

	// Send messages sequentially to avoid rate limiting
	for (const phone of filteredRecipients) {
		const result = await sendSMS({ to: phone, message, bypassDevMode: true });

		if (result.success) {
			results.sent++;
		} else {
			results.failed++;
			results.errors.push({ phone, error: result.error || 'Unknown error' });
		}

		// Small delay to avoid hitting rate limits
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	return results;
}

/**
 * Send personalized SMS to multiple recipients (each gets a different message)
 * In development mode, only sends to adminPhone
 */
export async function sendPersonalizedSMS(options: PersonalizedSMSOptions): Promise<{
	sent: number;
	failed: number;
	skipped: number;
	errors: Array<{ phone: string; error: string }>;
	devMode: boolean;
}> {
	const { messages, adminPhone } = options;

	// Filter messages based on dev mode
	const allPhones = messages.map(m => m.phone);
	const filteredPhones = filterRecipientsForDevMode(allPhones, adminPhone);
	const filteredMessages = messages.filter(m =>
		filteredPhones.includes(normalizePhoneNumber(m.phone))
	);

	const skippedCount = messages.length - filteredMessages.length;
	const devMode = isDevelopmentMode();

	if (devMode && skippedCount > 0) {
		console.log(`🧪 Development mode: Skipped ${skippedCount} SMS recipient(s)`);
	}

	const results = {
		sent: 0,
		failed: 0,
		skipped: skippedCount,
		errors: [] as Array<{ phone: string; error: string }>,
		devMode
	};

	// Send messages sequentially to avoid rate limiting
	for (const { phone, message } of filteredMessages) {
		const result = await sendSMS({ to: phone, message, bypassDevMode: true });

		if (result.success) {
			results.sent++;
		} else {
			results.failed++;
			results.errors.push({ phone, error: result.error || 'Unknown error' });
		}

		// Small delay to avoid hitting rate limits
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	return results;
}
