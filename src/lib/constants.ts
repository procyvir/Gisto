// Keep ROOMS ids in sync with ROOM_IDS in firestore.rules.
export type Room = { id: string; name: string; topic: string; icon: string; blurb: string };

export const ROOMS: Room[] = [
  { id: 'lagos', name: 'Lagos Hangout', topic: 'Cities', icon: '🌆', blurb: 'Island, mainland, everybody welcome' },
  { id: 'abuja', name: 'Abuja Connect', topic: 'Cities', icon: '🏛️', blurb: 'FCT people, gather here' },
  { id: 'ibadan', name: 'Ibadan Vibes', topic: 'Cities', icon: '🏞️', blurb: 'Amala, UI, and gist' },
  { id: 'ph', name: 'Port Harcourt Link', topic: 'Cities', icon: '🌊', blurb: 'Garden City gist' },
  { id: 'diaspora', name: 'Naija Abroad', topic: 'Cities', icon: '✈️', blurb: 'Canada, UK, US and beyond' },
  { id: 'football', name: 'Football Banter', topic: 'Interests', icon: '⚽', blurb: 'Matchday gist and banter' },
  { id: 'music', name: 'Naija Music', topic: 'Interests', icon: '🎶', blurb: 'New songs, old school, beats' },
  { id: 'tech', name: 'Tech & Careers', topic: 'Interests', icon: '💻', blurb: 'Jobs, coding, side hustles' },
  { id: 'campus', name: 'Campus Gist', topic: 'Students', icon: '🎓', blurb: 'Lectures, exams, hostel life' },
  { id: 'relationships', name: 'Love & Relationships', topic: 'Social', icon: '💬', blurb: 'Advice, stories, no insults' },
];

export const CITIES = ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Kano', 'Enugu', 'Benin', 'Abeokuta', 'Other Nigeria', 'Outside Nigeria'];

// Credit amounts are set in functions/src/index.ts.
export const RANKS: [string, number][] = [
  ['Fresh', 0],
  ['Regular', 50],
  ['Gister', 150],
  ['Influencer', 400],
  ['Oga', 900],
  ['Odogwu', 2000],
];

export function rankOf(credits: number) {
  let i = 0;
  RANKS.forEach(([, min], j) => {
    if (credits >= min) i = j;
  });
  const next = RANKS[i + 1];
  const floor = RANKS[i][1];
  const progress = next ? (credits - floor) / (next[1] - floor) : 1;
  return { name: RANKS[i][0], index: i, next, progress };
}

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@example.com';
