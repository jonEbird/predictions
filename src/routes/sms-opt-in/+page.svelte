<script lang="ts">
	import { SITE_NAME, SITE_URL } from '$lib/config';

	const contactEmail = 'jonEbird@gmail.com';
	const lastUpdated = 'September 3, 2026';
</script>

<svelte:head>
	<title>SMS Terms &amp; Privacy Policy | {SITE_NAME}</title>
	<meta
		name="description"
		content="How {SITE_NAME} members opt in to text messages, what messages they receive, how to opt out, and how their information is handled."
	/>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sm:p-10">
		<h1
			class="text-3xl font-bold text-gray-900 dark:text-gray-100 pb-3 border-b-4 border-red-700 dark:border-red-600"
		>
			SMS Terms &amp; Privacy Policy
		</h1>

		<dl class="mt-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
			<div class="flex flex-wrap gap-x-2">
				<dt class="font-semibold">Business:</dt>
				<dd>Jonathan Miller, doing business as {SITE_NAME}</dd>
			</div>
			<div class="flex flex-wrap gap-x-2">
				<dt class="font-semibold">Website:</dt>
				<dd><a href={SITE_URL} class="text-blue-600 dark:text-blue-400 hover:underline">{SITE_URL}</a></dd>
			</div>
			<div class="flex flex-wrap gap-x-2">
				<dt class="font-semibold">Contact:</dt>
				<dd>
					<a href="mailto:{contactEmail}" class="text-blue-600 dark:text-blue-400 hover:underline">
						{contactEmail}
					</a>
				</dd>
			</div>
			<div class="flex flex-wrap gap-x-2">
				<dt class="font-semibold">Last updated:</dt>
				<dd>{lastUpdated}</dd>
			</div>
		</dl>

		<div class="mt-8 space-y-8 text-gray-700 dark:text-gray-300">
			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
					About {SITE_NAME}
				</h2>
				<p>
					{SITE_NAME} is a private, invitation-only college football prediction game played by a closed
					group of friends. Members guess the score of upcoming games and are ranked on a season
					leaderboard. No money is wagered, no entry fee is charged, and no prize of monetary value is
					awarded &mdash; the season prize is a cup of coffee. This is a recreational game among
					friends, not a gambling or wagering service.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
					How members opt in to text messages
				</h2>
				<p>
					Accounts are created by the group administrator for people who have personally asked to
					join. There is no public sign-up. Text messaging is off by default for every account. A
					member turns it on themselves, while signed in, on their own profile page:
				</p>
				<ol class="list-decimal pl-6 mt-3 space-y-2">
					<li>
						The member signs in at
						<a href={SITE_URL} class="text-blue-600 dark:text-blue-400 hover:underline">
							{SITE_URL.replace('https://', '')}
						</a>
						and opens their Profile page.
					</li>
					<li>
						Under <strong>Notification Preferences</strong>, the member checks the SMS consent box,
						which reads:
					</li>
				</ol>

				<blockquote
					class="my-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md italic"
				>
					I agree to receive text messages from {SITE_NAME} about game reminders, results, and group
					announcements at the phone number on my account. Message frequency varies, typically 1&ndash;3
					messages per week during football season. Message and data rates may apply. Reply STOP to
					unsubscribe or HELP for help.
				</blockquote>

				<ol class="list-decimal pl-6 space-y-2" start="3">
					<li>
						The member clicks <strong>Save Profile</strong>. No text messages are sent to anyone who
						has not checked this box.
					</li>
				</ol>

				<div
					class="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-700 dark:border-red-600 rounded-r-md"
				>
					<strong>Consent is specific and separate.</strong> Checking this box is not a condition of
					using {SITE_NAME}, is not bundled with any other agreement, and applies only to messages
					sent by {SITE_NAME}. Members can use every part of the site without it.
				</div>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
					Messages you will receive
				</h2>
				<ul class="list-disc pl-6 space-y-2">
					<li>
						<strong>Game reminders:</strong> a nudge before kickoff if you have not entered a
						prediction yet.
					</li>
					<li><strong>Game results:</strong> the final score and how your prediction placed.</li>
					<li>
						<strong>Group announcements:</strong> occasional notes from the group administrator.
					</li>
				</ul>
				<p class="mt-3">Every message identifies {SITE_NAME} as the sender. Sample message:</p>
				<blockquote
					class="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md italic"
				>
					{SITE_NAME}: Game is TODAY! Predict NOW! Ohio State vs Michigan at 12:00 PM EST.
					{SITE_URL} Reply STOP to opt out.
				</blockquote>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Message frequency</h2>
				<ul class="list-disc pl-6 space-y-2">
					<li>Roughly 1&ndash;3 messages per week during the college football season</li>
					<li>No messages during the off-season</li>
					<li>Occasional administrative messages as needed</li>
				</ul>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">How to opt out</h2>
				<p>You can stop the messages at any time, by any of these methods:</p>
				<ol class="list-decimal pl-6 mt-3 space-y-2">
					<li>
						<strong>Reply STOP</strong> to any message from us. You will receive one confirmation
						message and then no further messages.
					</li>
					<li><strong>Uncheck the SMS box</strong> on your Profile page and save.</li>
					<li>
						<strong>Email the administrator</strong> at
						<a href="mailto:{contactEmail}" class="text-blue-600 dark:text-blue-400 hover:underline">
							{contactEmail}
						</a>
						and ask to be removed.
					</li>
				</ol>
				<p class="mt-3">
					Reply <strong>HELP</strong> to any message for help, or email the address above.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
					Message and data rates
				</h2>
				<p>
					Message and data rates may apply according to your mobile carrier plan. {SITE_NAME} charges
					nothing for text messages.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Privacy</h2>
				<p>
					We collect only what the game needs: your name, email address, and &mdash; if you choose to
					give it &mdash; your mobile phone number. Phone numbers are used solely to send the messages
					described above.
				</p>
				<ul class="list-disc pl-6 mt-3 space-y-2">
					<li>
						We do not sell, rent, or share phone numbers or any personal information with third
						parties.
					</li>
					<li>
						Mobile information is never shared with third parties or affiliates for marketing or
						promotional purposes.
					</li>
					<li>
						Text messages are delivered through Twilio, our messaging provider, acting solely on our
						behalf.
					</li>
					<li>
						Data is retained only while you are a member of the group. Email the administrator to
						have your account and phone number deleted.
					</li>
				</ul>
			</section>
		</div>

		<p class="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
			This policy governs text messages sent by {SITE_NAME} to members who have opted in on their
			profile page at {SITE_URL.replace('https://', '')}.
		</p>
	</div>
</div>
