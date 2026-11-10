// A basic client-side filter. App Store review requires apps with user-generated
// content to filter objectionable material; extend this list for your audience.
// Server-side moderation (reports + bans) is the real safety net.
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'whore', 'mumu', 'ashawo', 'olodo', 'werey'];

const pattern = new RegExp(`\\b(${BLOCKED.join('|')})\\b`, 'gi');

export function cleanText(text: string) {
  return text.replace(pattern, (w) => w[0] + '*'.repeat(w.length - 1));
}

export const MAX_MESSAGE = 500;
