import { RESEND_API_KEY, RESEND_FROM_EMAIL } from '$env/static/private';
import { Resend } from 'resend';

const resend = new Resend(RESEND_API_KEY);

export interface SendEmailOptions {
	to: string | string[];
	subject: string;
	html: string;
	text?: string; // Plain text version (optional)
}

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

export interface BulkEmailOptions {
	recipients: string[];
	subject: string;
	html: string;
	text?: string;
	adminEmail?: string; // In dev mode, only send to this email
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Check if we're in development mode
 */
function isDevelopmentMode(): boolean {
	return process.env.NODE_ENV !== 'production';
}

/**
 * Filter recipients based on development mode
 * In dev mode, only sends to adminEmail if provided
 */
function filterRecipientsForDevMode(recipients: string[], adminEmail?: string): string[] {
	if (!isDevelopmentMode()) {
		return recipients; // Production: send to all
	}

	if (!adminEmail) {
		console.warn('🧪 Development mode: No admin email provided, no emails will be sent');
		return [];
	}

	// Normalize emails for comparison (lowercase)
	const normalizedAdmin = adminEmail.toLowerCase();
	const normalizedRecipients = recipients.map(r => r.toLowerCase());

	if (normalizedRecipients.includes(normalizedAdmin)) {
		console.log('🧪 Development mode: Only sending email to admin user:', adminEmail);
		return [adminEmail];
	}

	console.warn('🧪 Development mode: Admin email not in recipient list, no emails will be sent');
	console.warn('   Admin email:', adminEmail);
	console.warn('   Recipients:', recipients);
	return [];
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
	try {
		const { to, subject, html, text } = options;

		// Validate email addresses
		const recipients = Array.isArray(to) ? to : [to];
		for (const email of recipients) {
			if (!isValidEmail(email)) {
				console.error('Invalid email address:', email);
				return {
					success: false,
					error: `Invalid email address: ${email}`
				};
			}
		}

		console.log(`📧 Sending email to ${recipients.join(', ')}`);
		console.log(`   From: ${RESEND_FROM_EMAIL}`);
		console.log(`   Subject: ${subject}`);

		const result = await resend.emails.send({
			from: RESEND_FROM_EMAIL,
			to: recipients,
			subject,
			html,
			text
		});

		if (result.error) {
			console.error('❌ Failed to send email:', result.error);
			return {
				success: false,
				error: result.error.message
			};
		}

		console.log(`✅ Email sent successfully! ID: ${result.data?.id}`);

		return {
			success: true,
			messageId: result.data?.id
		};
	} catch (error) {
		console.error('❌ Failed to send email:', error);
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
 * Send email to multiple recipients
 * In development mode, only sends to adminEmail
 */
export async function sendBulkEmail(options: BulkEmailOptions): Promise<{
	sent: number;
	failed: number;
	skipped: number;
	errors: Array<{ email: string; error: string }>;
	devMode: boolean;
}> {
	const { recipients, subject, html, text, adminEmail } = options;

	// Filter recipients based on dev mode
	const filteredRecipients = filterRecipientsForDevMode(recipients, adminEmail);
	const skippedCount = recipients.length - filteredRecipients.length;
	const devMode = isDevelopmentMode();

	if (devMode && skippedCount > 0) {
		console.log(`🧪 Development mode: Skipped ${skippedCount} recipient(s)`);
	}

	const results = {
		sent: 0,
		failed: 0,
		skipped: skippedCount,
		errors: [] as Array<{ email: string; error: string }>,
		devMode
	};

	// Validate all email addresses first
	const validRecipients = filteredRecipients.filter(email => {
		if (!isValidEmail(email)) {
			console.warn(`⚠️  Skipping invalid email: ${email}`);
			results.failed++;
			results.errors.push({ email, error: 'Invalid email format' });
			return false;
		}
		return true;
	});

	if (validRecipients.length === 0) {
		console.warn('⚠️  No valid email recipients');
		return results;
	}

	// Send emails sequentially to avoid rate limiting
	for (const email of validRecipients) {
		const result = await sendEmail({ to: email, subject, html, text });

		if (result.success) {
			results.sent++;
		} else {
			results.failed++;
			results.errors.push({ email, error: result.error || 'Unknown error' });
		}

		// Small delay to avoid hitting rate limits (Resend limit: 10 emails/second on free tier)
		await new Promise(resolve => setTimeout(resolve, 150));
	}

	return results;
}

/**
 * Create a simple HTML email template
 */
export function createEmailTemplate(options: {
	title: string;
	body: string;
	footerText?: string;
}): { html: string; text: string } {
	const { title, body, footerText = 'Buckeye Predictions' } = options;

	const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			max-width: 600px;
			margin: 0 auto;
			padding: 20px;
			background-color: #f5f5f5;
		}
		.container {
			background: white;
			padding: 30px;
			border-radius: 8px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		h1 {
			color: #bb0000;
			border-bottom: 3px solid #bb0000;
			padding-bottom: 10px;
			margin-top: 0;
		}
		.footer {
			margin-top: 30px;
			padding-top: 20px;
			border-top: 1px solid #ddd;
			font-size: 0.9em;
			color: #666;
			text-align: center;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>${title}</h1>
		${body}
		<div class="footer">
			${footerText}
		</div>
	</div>
</body>
</html>
	`.trim();

	// Create plain text version by stripping HTML tags
	const text = `
${title}
${'='.repeat(title.length)}

${body.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n')}

---
${footerText}
	`.trim();

	return { html, text };
}
