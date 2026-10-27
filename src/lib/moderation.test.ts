import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsUrl,
  containsPhoneNumber,
  SpamTrackerTS,
  evaluateMessageTS,
  maskSecretTS,
  maskPhoneNumberTS,
  formatWelcomeMessageTS,
  DEFAULT_CONFIG,
} from './moderation';

test('URL Detection: detects standard, bare, and invite links', () => {
  assert.equal(containsUrl('Check https://turbonex.xyz').hasUrl, true);
  assert.equal(containsUrl('Join us at t.me/+SecretInvite').hasUrl, true);
  assert.equal(containsUrl('Visit scam-site.top/claim').hasUrl, true);
  assert.equal(containsUrl('turbonex [dot] xyz').hasUrl, true);
  assert.equal(containsUrl('Hello TurboNex team, exciting update!').hasUrl, false);
});

test('Phone Number Detection: catches international and formatted numbers', () => {
  assert.equal(containsPhoneNumber('Call +1 555 234 5678').hasPhone, true);
  assert.equal(containsPhoneNumber('WhatsApp +44 7911 123456').hasPhone, true);
  assert.equal(containsPhoneNumber('Reach 555-839-2041').hasPhone, true);
  assert.equal(containsPhoneNumber('Call 9 8 7 6 5 4 3 2 1 0').hasPhone, true);
  
  // Safe numbers shouldn't trigger
  assert.equal(containsPhoneNumber('Release date is 2026-10-27').hasPhone, false);
  assert.equal(containsPhoneNumber('We reached 1500 members').hasPhone, false);
  assert.equal(containsPhoneNumber('Price is $45.99').hasPhone, false);
});

test('Anti-Spam Tracker: detects burst flooding and duplicate messages', () => {
  const tracker = new SpamTrackerTS(4, 5, 3, 20);
  const user = 42;
  const now = 1000;

  // 4 rapid messages allowed
  for (let i = 0; i < 4; i++) {
    const res = tracker.recordAndCheck(user, `msg ${i}`, now + i);
    assert.equal(res.isSpam, false);
  }

  // 5th rapid message triggers burst limit
  const burstRes = tracker.recordAndCheck(user, 'excessive msg', now + 4);
  assert.equal(burstRes.isSpam, true);
  assert.match(burstRes.reason, /Excessive posting rate/);

  // Duplicate test
  tracker.reset(user);
  const spam = 'BUY CRYPTO AIRDROP FAST';
  assert.equal(tracker.recordAndCheck(user, spam, now).isSpam, false);
  assert.equal(tracker.recordAndCheck(user, spam, now + 1).isSpam, false);
  const dupeRes = tracker.recordAndCheck(user, spam, now + 2);
  assert.equal(dupeRes.isSpam, true);
  assert.match(dupeRes.reason, /Repeated message detected/);
});

test('Admin Authorization: Admins bypass moderation filters and DEFAULT_CONFIG has no hardcoded admin IDs', () => {
  // Confirm no default or hardcoded admin IDs exist
  assert.equal(DEFAULT_CONFIG.adminIds.length, 0);

  const tracker = new SpamTrackerTS();
  const decisionAdmin = evaluateMessageTS(
    'Official announcement: https://turbonex.com/news',
    123456789,
    true,
    DEFAULT_CONFIG,
    tracker
  );
  assert.equal(decisionAdmin.shouldDelete, false);
  assert.equal(decisionAdmin.reason, 'Admin authorized - bypass active');

  const decisionMember = evaluateMessageTS(
    'Scam link: https://turbonex-fake.xyz',
    12345,
    false,
    DEFAULT_CONFIG,
    tracker
  );
  assert.equal(decisionMember.shouldDelete, true);
  assert.equal(decisionMember.violationType, 'url');
});

test('Secrets Security: Masks bot tokens and phone numbers safely', () => {
  assert.equal(maskSecretTS('7182938472:AAElskdfj-XYZ12345'), '7182***2345');
  assert.equal(maskSecretTS(''), '[NOT SET]');
  assert.equal(maskPhoneNumberTS('+1 (555) 234-5678'), '+1 (***78');
});

test('Welcome Template: Formats dynamic variables', () => {
  const rendered = formatWelcomeMessageTS(
    'Welcome {mention} to {group_name}! Rules: {rules_link}',
    'Sarah',
    'sarah_dev',
    554433,
    'TurboNex Official',
    'https://t.me/turbonex_rules'
  );
  assert.match(rendered, /@sarah_dev/);
  assert.match(rendered, /TurboNex Official/);
  assert.match(rendered, /https:\/\/t\.me\/turbonex_rules/);
});
