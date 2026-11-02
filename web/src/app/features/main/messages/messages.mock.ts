import { Member } from '../../../core/profile.model';
import { ChatMessage, Conversation } from './messages.model';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function member(id: string, name: string, pronouns: string, lookingFor: string[]): Member {
  return {
    id,
    name,
    pronouns,
    tagline: '',
    bio: 'Mock profile. The real one comes from `get_connected_profiles()`.',
    location: 'London',
    gender: [],
    sexuality: [],
    looking_for: lookingFor,
    photos: ['main'],
    age: null,
  };
}

/** Mock messages, each `[who, text, how long ago]`. */
function thread(id: string, lines: [who: 'me' | 'them', text: string, ago: number][]) {
  return lines.map(([who, text, ago], index): ChatMessage => ({
    id: `${id}-${index}`,
    mine: who === 'me',
    content: { type: 'text', text },
    createdAt: new Date(Date.now() - ago).toISOString(),
  }));
}

/**
 * Stand-in data for designing the tab, with one of each state. `empty`: a brand-new member's.
 * The photos in `public/mock/` are generated (thispersondoesnotexist.com), not of real people,
 * since real faces shouldn't appear on a dating app without their say-so.
 */
export function mockConversations(empty = false): Conversation[] {
  const team: Conversation = {
    person: member('team', 'Kitchen Table team', '', []),
    photoUrl: null,
    isTeam: true,
    status: 'accepted',
    initiatedByMe: false,
    lookingFor: [],
    lastReadAt: null,
    messages: thread('team', [
      [
        'them',
        "Hi, and welcome to Kitchen Table! I really enjoyed reading your application, especially what you wrote about community. If there's anything we could do better, or you just want to say hello, this is the place.",
        4 * DAY,
      ],
    ]),
  };
  if (empty) return [team];

  const seen = (ago: number) => new Date(Date.now() - ago).toISOString();
  team.lastReadAt = seen(HOUR);
  const noor = thread('noor', [
    [
      'me',
      "Hi Noor! Your line about hosting a board game night for your metamours made me laugh, mostly because I've been trying to organise the same thing for a year. What's the game that always ends in a real argument at yours?",
      9 * DAY,
    ],
    ['them', 'Oh, Wingspan, without question. Very polite, very vicious.', 8 * DAY + 3 * HOUR],
    ['them', "What's yours?", 8 * DAY + 3 * HOUR - MINUTE],
    ['me', 'Catan. We had to retire it after The Sheep Incident of 2024.', 8 * DAY + HOUR],
    ['them', "That's a very ominous sentence", 7 * DAY + 6 * HOUR],
    ['them', 'How did your year of organising go, by the way?', 7 * DAY + 6 * HOUR - MINUTE],
    [
      'me',
      "Badly! Six people, four calendars, and one person who only does alternate Thursdays. We've got as far as a shared spreadsheet.",
      7 * DAY + 2 * HOUR,
    ],
    ['me', 'The spreadsheet has tabs', 7 * DAY + 2 * HOUR - MINUTE],
    ['them', 'Tabs are how you know it’s serious', 6 * DAY + 5 * HOUR],
    [
      'them',
      'We just do the first Sunday of the month. Whoever turns up, turns up.',
      6 * DAY + 5 * HOUR - 2 * MINUTE,
    ],
    ['me', 'That sounds so much healthier', 6 * DAY + 4 * HOUR],
    ['me', 'Does everyone actually get along?', 6 * DAY + 4 * HOUR - MINUTE],
    [
      'them',
      "Mostly, yes. It took a while. My partner's partner and I were very careful with each other for about a year, and then we got stuck in a lift together and that sorted it out.",
      5 * DAY + 8 * HOUR,
    ],
    ['me', 'Recommended by therapists everywhere', 5 * DAY + 7 * HOUR],
    ['them', 'Honestly it should be', 5 * DAY + 6 * HOUR],
    ['them', 'What about you, how do your weeks look at the moment?', 4 * DAY + 9 * HOUR],
    [
      'me',
      "Fairly full, in a good way. I've got a nesting partner, a long-distance partner who visits once a month, and a choir that takes up Tuesdays.",
      4 * DAY + 3 * HOUR,
    ],
    ['them', 'A choir! What kind?', 3 * DAY + 7 * HOUR],
    ['me', "The kind that's mostly there for the pub afterwards", 3 * DAY + 5 * HOUR],
    ['them', 'The best kind', 2 * DAY + 9 * HOUR],
    ['me', 'So, The Sheep Incident. Do you really want to know?', DAY + 2 * HOUR],
    // Unread from here, enough to fill a phone's screen.
    ['them', 'Yes! I’ve been waiting all week', 11 * HOUR],
    ['them', 'I told my partner about it and now they want to know too', 11 * HOUR - MINUTE],
    ['them', 'Sorry, I’ve just realised I never answered about Sunday', 9 * HOUR],
    [
      'them',
      'We’re doing Wingspan again, then food. You’d be very welcome, but no pressure at all. I know that’s a lot of new people at once.',
      9 * HOUR - 2 * MINUTE,
    ],
    ['them', 'It might be nicer to meet just the two of us first anyway', 9 * HOUR - 3 * MINUTE],
    [
      'them',
      'I’m a bit slow to warm up, for what it’s worth. I’m better in person than over messages, and better on the second hour than the first.',
      6 * HOUR,
    ],
    ['them', 'Same with Wingspan, actually', 6 * HOUR - MINUTE],
    ['them', 'Also I looked up your choir', 5 * HOUR],
    ['them', 'You have a concert in December??', 5 * HOUR - MINUTE],
    ['them', 'I might have to come and heckle', 5 * HOUR - 2 * MINUTE],
    [
      'them',
      'Politely. In harmony. I’ll bring my partner’s partner, who has a very good singing voice and no shame at all.',
      4 * HOUR,
    ],
    ['them', 'Anyway, I’ve been thinking', HOUR],
    ['them', 'I need to hear about The Sheep Incident in person', 40 * MINUTE],
    ['them', 'Are you free for a coffee this weekend? I know a place in Peckham', 38 * MINUTE],
  ]);
  const rowan = thread('rowan', [
    [
      'them',
      "Hello! You mentioned you volunteer at the community garden in Hackney. I've just started growing things on my balcony and it's going badly. Would love to swap notes, and maybe tomatoes if I ever get any.",
      6 * DAY,
    ],
    ['me', 'Balcony tomatoes are a brave start. What went wrong?', 5 * DAY],
    ['them', 'Pigeons. So many pigeons.', 2 * DAY],
    ['me', 'Netting! I can bring you some spare netting on Saturday', 22 * HOUR],
    ['me', "It's by the Dalston entrance, I'll be there from 10", 3 * HOUR],
  ]);
  rowan[rowan.length - 1].delivery = 'failed';

  return [
    team,
    {
      person: member('noor', 'Noor', 'they/them', ['polyamory', 'friends']),
      photoUrl: '/mock/noor.jpg',
      isTeam: false,
      status: 'accepted',
      initiatedByMe: true,
      lookingFor: ['polyamory', 'friends'],
      lastReadAt: seen(DAY),
      messages: noor,
    },
    {
      person: member('rowan', 'Rowan', 'she/her', ['friends', 'exploring']),
      photoUrl: '/mock/rowan.jpg',
      isTeam: false,
      status: 'accepted',
      initiatedByMe: false,
      lookingFor: ['friends'],
      lastReadAt: seen(HOUR),
      messages: rowan,
    },
    {
      // Accepted the viewer's intro, and the viewer hasn't opened it since.
      person: member('tomasz', 'Tomasz', 'he/him', ['relationship-anarchy']),
      photoUrl: '/mock/tomasz.jpg',
      isTeam: false,
      status: 'accepted',
      initiatedByMe: true,
      lookingFor: ['relationship-anarchy'],
      lastReadAt: null,
      messages: thread('tomasz', [
        [
          'me',
          "Hi Tomasz! I liked what you wrote about relationship anarchy meaning more paperwork, not less. I've got a shared calendar with too many colours in it, so I felt seen. What do your weeks look like at the moment?",
          26 * HOUR,
        ],
      ]),
    },
    {
      person: member('ife', 'Ife', 'he/they', ['casual']),
      photoUrl: '/mock/ife.jpg',
      isTeam: false,
      status: 'ended',
      initiatedByMe: true,
      lookingFor: ['casual'],
      lastReadAt: seen(HOUR),
      messages: [
        ...thread('ife', [
          [
            'me',
            "Hi Ife, your photo from the climbing wall in Bermondsey caught my eye. I'm a very nervous beginner. Any tips?",
            24 * DAY,
          ],
          ['them', "Trust your feet, and don't look down until you're ready!", 23 * DAY],
          ['me', 'Good advice for a lot of things', 22 * DAY],
          [
            'them',
            "It was lovely chatting. I've got less room for new connections just now.",
            16 * DAY,
          ],
        ]),
        {
          id: 'ife-ended',
          mine: false,
          content: { type: 'ended' },
          createdAt: new Date(Date.now() - 16 * DAY).toISOString(),
        },
      ],
    },
    {
      // Requests for the Connections tab: the two new ones show in the bottom nav's badge.
      person: {
        ...member('maya', 'Maya', 'she/her', [
          'polyamory',
          'friends',
          'exploring',
          'open-relationship',
        ]),
        tagline: 'Hosts a monthly supper club, likes a long table',
        bio: "I host a monthly supper club: twelve people, one long table, no phones out. It started as a way to feed friends after a bad year and turned into the best part of my month.\n\nI have a partner of six years who you'd probably meet at the table eventually. Slow is good. I would rather cook with someone twice than message for a fortnight.",
        gender: ['Woman'],
        sexuality: ['Queer'],
        age: 34,
      },
      photoUrl: '/mock/maya.jpg',
      isTeam: false,
      status: 'pending',
      initiatedByMe: false,
      lookingFor: ['polyamory', 'friends', 'exploring', 'open-relationship'],
      lastReadAt: null,
      messages: thread('maya', [
        [
          'them',
          "Hi! You said the best evenings are the ones where nobody checks the time, and that's more or less why I started a supper club. There's a seat at the table this month if you fancy it, no pressure at all. What would you bring?",
          3 * HOUR,
        ],
      ]),
    },
    {
      person: {
        ...member('sami', 'Sami', 'he/him', ['relationship-anarchy', 'friends', 'casual']),
        tagline: 'Two partners, one allotment, endless tomatoes',
        bio: 'Two partners, one allotment, and more tomatoes than any household needs by August. I am usually the person who brings the surplus to the pub.\n\nI am not looking to add a third to anything. I am looking for people whose company I want on a Tuesday.',
        gender: ['Man'],
        sexuality: ['Bisexual'],
        age: 41,
      },
      photoUrl: '/mock/sami.jpg',
      isTeam: false,
      status: 'pending',
      initiatedByMe: false,
      lookingFor: ['relationship-anarchy', 'friends', 'casual'],
      lastReadAt: null,
      messages: thread('sami', [
        [
          'them',
          "Hello. I don't usually write first, but your bit about wanting people for the ordinary days stopped me scrolling. Most of mine involve soil.\n\nWould you like to come and be unimpressed by my allotment some time?",
          26 * HOUR,
        ],
      ]),
    },
    {
      person: {
        ...member('ellie', 'Ellie', 'she/they', ['friends', 'exploring']),
        tagline: 'Sunday swims, bookshop shifts, firm views on biscuits',
        bio: 'Bookshop shifts most weekdays, Sunday swims at the lido whatever the temperature. I will talk about either at length.\n\nNew to organised dating, not new to non-monogamy.',
        gender: ['Non-binary', 'Woman'],
        sexuality: ['Pansexual'],
        age: 38,
      },
      photoUrl: '/mock/ellie.jpg',
      isTeam: false,
      status: 'pending',
      initiatedByMe: false,
      lookingFor: ['friends', 'exploring'],
      lastReadAt: seen(DAY),
      messages: thread('ellie', [['them', 'Fellow Sunday swimmer? Say hi!', 2 * DAY]]),
    },
    {
      // Not listed: an intro nobody has answered yet.
      person: member('priya', 'Priya', 'she/they', ['polyamory']),
      photoUrl: null,
      isTeam: false,
      status: 'pending',
      initiatedByMe: true,
      lookingFor: ['polyamory'],
      lastReadAt: null,
      messages: thread('priya', [
        [
          'me',
          "Hi Priya! You said the best date you ever had was a walk along the canal that turned into a five-hour talk about attachment. I'd like to hear how that happened. Any walks you'd recommend?",
          2 * DAY,
        ],
      ]),
    },
  ];
}
