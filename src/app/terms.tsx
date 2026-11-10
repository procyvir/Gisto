import { ScrollView, Text } from 'react-native';
import { s } from '../components/ui';
import { CONTACT_EMAIL } from '../lib/constants';

// Plain-language rules. Replace with your lawyer-reviewed Terms of Use and Privacy Policy
// before launch, and host the same text at a public URL for the store listings.
const SECTIONS: [string, string][] = [
  [
    'Zero tolerance',
    'Gisto has zero tolerance for objectionable content or abusive users. No harassment, bullying, hate speech, threats, sexual content, scams or spam. Accounts that break these rules are removed.',
  ],
  ['Age', 'You must be 13 or older to use Gisto.'],
  [
    'Report and block',
    'Tap any name, or long-press any message, to report or block. Blocked users disappear from your rooms and chats. We review reports within 24 hours and remove offending content and users.',
  ],
  [
    'Your data',
    'We store your email, username, city, messages, buddies and credits so the app can work. We do not sell your data. Delete your account any time from Me → Delete my account; this removes your profile and login.',
  ],
  ['Credits', 'Credits and ranks are for fun. They have no cash value and cannot be bought, sold or transferred.'],
  ['Contact', `Questions or appeals: ${CONTACT_EMAIL}`],
];

export default function Terms() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 18, gap: 6, paddingBottom: 40 }}>
      {SECTIONS.map(([h, b]) => (
        <Text key={h} style={s.body}>
          <Text style={{ fontWeight: '800' }}>{h}{'\n'}</Text>
          {b}
          {'\n'}
        </Text>
      ))}
    </ScrollView>
  );
}
