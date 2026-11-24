// Demo cast for trying things out and for screen recordings: animals with playful,
// obviously-fake profiles, deliberately not realistic people (no stereotyping the people the app
// is for). Seeded with seed.mts.
// Photos are in ./photos/<photo key>/{full,thumb}.jpg (CC0 / public domain, see sources.json).

export interface CastMember {
  key: string;
  name: string;
  pronouns: string;
  tagline: string;
  bio: string;
  gender: string[];
  sexuality: string[];
  /** [year, month] or null for no age. */
  born: [number, number] | null;
  looking_for: string[];
  /** Photo keys, main photo first. */
  photos: string[];
}

export interface Applicant extends CastMember {
  vetting_answers: Record<string, string>;
}

/** Live members, newest first (that's the order search shows them in). */
export const MEMBERS: CastMember[] = [
  {
    key: 'bean',
    name: 'Bean',
    pronouns: 'they/them',
    tagline: 'Professional blanket burrito',
    bio: "Hi, I'm Bean. I'm a pug, which means I breathe loudly and have no regrets about it. My ideal Sunday is a blanket, a second blanket, and someone to tell me I'm doing great. I'm looking for friends who won't judge me for snoring through the second half of the film. Can't do stairs. Will do brunch.",
    gender: ['Non-binary'],
    sexuality: ['Queer'],
    born: [1994, 3],
    looking_for: ['friends', 'Nap buddies', 'exploring'],
    photos: ['bean-0', 'bean-1', 'bean-2'],
  },
  {
    key: 'biscuit',
    name: 'Biscuit',
    pronouns: 'he/him',
    tagline: 'Low to the ground, high in spirits',
    bio: "Corgi, about thirty centimetres of pure enthusiasm. I have herded every picnic I've been to into one big group, and honestly everyone was happier for it. Big fan of kitchen tables, especially ones with snacks on them. My last photo is me with two of my favourite people (the cats are very supportive). Strong opinions about sticks.",
    gender: ['Man'],
    sexuality: ['Pansexual'],
    born: [1991, 7],
    looking_for: ['polyamory', 'friends', 'Picnic organising'],
    photos: ['biscuit-0', 'biscuit-1', 'biscuit-2'],
  },
  {
    key: 'fringe',
    name: 'Fringe',
    pronouns: 'she/they',
    tagline: 'Excellent fringe, emotionally available',
    bio: "Highland cow, originally from somewhere much windier than London. I can't see much through the fringe but I hear you, and I'm told that's the important part. Into long walks (slowly), wild swimming (in puddles) and saying moo at exactly the wrong moment. Looking for people who like a good chat and don't mind a bit of mud on the sofa.",
    gender: ['Woman', 'Genderqueer'],
    sexuality: ['Bisexual'],
    born: [1988, 10],
    looking_for: ['relationship-anarchy', 'friends', 'casual'],
    photos: ['fringe-0', 'fringe-1'],
  },
  {
    key: 'mochi',
    name: 'Mochi',
    pronouns: 'she/her',
    tagline: 'Will knock your coffee off the table, lovingly',
    bio: 'Tabby cat with a rich inner life and an even richer coat. I love you, but on my schedule, which is mostly 4am. Interests: sunbeams, closed doors (against), cardboard boxes (for) and pushing small objects to their logical conclusion. Reach out if you have a warm laptop I can sit on while you try to work.',
    gender: ['Woman'],
    sexuality: ['Lesbian'],
    born: [1996, 1],
    looking_for: ['polyamory', 'exploring'],
    photos: ['mochi-0', 'mochi-1'],
  },
  {
    key: 'toffee',
    name: 'Toffee',
    pronouns: 'she/her',
    tagline: 'Small horse, big hair, bigger feelings',
    bio: "Shetland pony with a mane that needs its own support team. I'm small but I have opinions, mostly about apples. I'm the friend who shows up with snacks and leaves with yours. Looking for good company, gentle grooming and someone to tell me my fringe looks great even when it's raining sideways.",
    gender: ['Woman'],
    sexuality: ['Heteroflexible'],
    born: [1985, 5],
    looking_for: ['open-relationship', 'friends', 'Hair care tips'],
    photos: ['toffee-0', 'toffee-1'],
  },
  {
    key: 'lettuce',
    name: 'Lettuce',
    pronouns: 'any pronouns',
    tagline: 'Gets along with literally everyone',
    bio: "Capybara. Birds sit on me, monkeys sit on me, once a duck had a nap on me and I said nothing. I'm extremely calm and my love language is sitting in warm water next to you without talking. Looking for low-drama connections and a hot spring within Zone 2. This is a placeholder bio, but I'd stand by it.",
    gender: [],
    sexuality: [],
    born: null,
    looking_for: ['relationship-anarchy', 'friends', 'exploring'],
    photos: ['lettuce-0', 'lettuce-1'],
  },
  {
    key: 'hammy',
    name: 'Hammy',
    pronouns: 'they/them',
    tagline: 'Cheeks full, heart fuller',
    bio: "Hamster. Yes, that's a tiny chair in my second photo, and no, I won't be taking questions about it. I run about nine kilometres a night without going anywhere, which I believe makes me a philosopher. Looking for friends to share snacks with. I will put most of the snacks in my cheeks for later, that's just how I am.",
    gender: ['Agender'],
    sexuality: ['Asexual'],
    born: [1999, 8],
    looking_for: ['friends', 'Wheel running'],
    photos: ['hammy-0', 'hammy-1'],
  },
  {
    key: 'elvis',
    name: 'Elvis',
    pronouns: 'he/him',
    tagline: 'The hair is natural. The attitude too.',
    bio: "Rockhopper penguin, which means I hop on rocks, professionally. I've had this hairstyle since birth and I'm not changing it for anyone. I'm a great listener as long as you don't mind me standing very close. Looking for someone to go to gigs with, ideally somewhere chilly. Dress code: formal, always.",
    gender: ['Man'],
    sexuality: ['Gay'],
    born: [1990, 2],
    looking_for: ['casual', 'friends', 'Gig buddies'],
    photos: ['elvis-0'],
  },
  {
    key: 'reginald',
    name: 'Sir Reginald Fluffington III',
    pronouns: 'he/they',
    tagline: 'Hums when happy. Hums a lot.',
    bio: "Alpaca of good standing. The title is self-awarded, but I've been using it for years and nobody has stopped me. I hum when I'm content, which is most of the time, and spit only in extreme circumstances, such as being offered decaf. Seeking thoughtful conversation, long-necked hugs and someone who appreciates a good haircut (mine, specifically).",
    gender: ['Man', 'Genderfluid'],
    sexuality: ['Queer'],
    born: [1979, 11],
    looking_for: ['polyamory', 'friends'],
    photos: ['reginald-0', 'reginald-1'],
  },
  {
    key: 'frankie',
    name: 'Frankie',
    pronouns: 'she/her',
    tagline: 'Long dog, longer stories',
    bio: 'Dachshund, about two dogs long. I have big eyes and I know exactly how to use them. Ask me about the time I chased a pigeon for three streets and then forgot why. Looking for cosy pub evenings, pals for the park and someone with a sofa wide enough for the full length of me. Test profile, real enthusiasm.',
    gender: ['Woman'],
    sexuality: ['Bisexual'],
    born: [1993, 9],
    looking_for: ['exploring', 'friends', 'polyamory'],
    photos: ['frankie-0', 'frankie-1'],
  },
  {
    key: 'gerald',
    name: 'Gerald',
    pronouns: 'he/him',
    tagline: 'Takes things slow. Like, really slow.',
    bio: "Tortoise. I've read your message and I'm composing a reply, please give me until roughly March. I believe in taking things slow, building trust, and arriving eventually. Hobbies include lettuce, sunbathing and outliving houseplants. If you're looking for someone steady who will absolutely be there, just a bit later than planned, hello.",
    gender: ['Man'],
    sexuality: ['Straight'],
    born: [1964, 6],
    looking_for: ['open-relationship', 'Slow mornings'],
    photos: ['gerald-0', 'gerald-1'],
  },
  {
    key: 'fig',
    name: 'Fig',
    pronouns: 'he/they',
    tagline: 'Caught mid-yawn, as usual',
    bio: "Urban fox, local to the area, frequently seen near your bins at 3am (it's not what it looks like). My first photo is my best side. I'm told I scream at night, which I prefer to call singing. Into night walks, mousing and curling up somewhere warm. Looking for people with similar sleep schedules and flexible opinions about compost.",
    gender: ['Genderqueer'],
    sexuality: ['Queer'],
    born: [1995, 6],
    looking_for: ['casual', 'exploring', 'friends'],
    photos: ['fig-0', 'fig-1'],
  },
  {
    key: 'waffles',
    name: 'Waffles',
    pronouns: 'they/them',
    tagline: 'Ears down, standards up',
    bio: "Lop-eared rabbit. My ears point at the floor, which I find keeps me grounded. I like gardens, quiet mornings and people who take time to get to know me before I let them near my favourite carrot. Bonding takes a while for rabbits, so please be patient, it's worth it. I do a little jump when I'm happy. You'll see.",
    gender: ['Non-binary'],
    sexuality: ['Demisexual'],
    born: [1997, 4],
    looking_for: ['friends', 'Garden visits'],
    photos: ['waffles-0'],
  },
  {
    key: 'sunny',
    name: 'Sunny',
    pronouns: 'he/him',
    tagline: 'Thinks everyone is his best friend. Is correct.',
    bio: "Golden retriever, senior edition. I've never met a person I didn't like, and I've met most of London. My hobbies are greeting you at the door, greeting you at the door again, and lying on the cool kitchen tiles while you cook. Gentle, loyal and slightly hairy. I'll bring the tennis ball, you bring the throwing arm.",
    gender: ['Man'],
    sexuality: ['Heteroflexible'],
    born: [1983, 8],
    looking_for: ['friends', 'polyamory', 'open-relationship'],
    photos: ['sunny-0', 'sunny-1'],
  },
  {
    key: 'hoot',
    name: 'Professor Hoot',
    pronouns: 'she/her',
    tagline: 'Up late. Asks who. Every time.',
    bio: "Eagle owl and part-time academic. Nobody remembers giving me the title, so I'm keeping it. Night owl, literally. I'm wise in the way that comes from staring at things for a very long time without blinking. I can turn my head almost all the way round, which is useful at parties. Looking for deep conversations after midnight and people who think 4am is early evening.",
    gender: ['Woman'],
    sexuality: ['Pansexual'],
    born: [1975, 2],
    looking_for: ['polyamory', 'relationship-anarchy'],
    photos: ['hoot-0'],
  },
  {
    key: 'kiwi',
    name: 'Kiwi',
    pronouns: 'any pronouns',
    tagline: 'Repeats your best jokes back to you',
    bio: "Parrot, extremely green and very loud about it. I can say forty words and three of them are your name. I'll learn your favourite song and sing it at you until it's my favourite song too. Looking for karaoke partners, bright mornings and someone who'll share their toast. Not available before sunrise, or after the cover goes on.",
    gender: [],
    sexuality: ['Queer'],
    born: [1987, 3],
    looking_for: ['friends', 'Karaoke'],
    photos: ['kiwi-0', 'kiwi-1'],
  },
  {
    key: 'pebble',
    name: 'Pebble',
    pronouns: 'they/them',
    tagline: 'Professional loaf, amateur swimmer',
    bio: "Seal pup, and yes, I always look this surprised. Still working most things out, including which way the sea is. Very good at lying on beaches, quite good at looking photogenic, terrible at small talk but great at big talk. I'm here to meet new people, learn the ropes and maybe find someone to share a sandbank with.",
    gender: ['Gender questioning'],
    sexuality: ['Questioning'],
    born: [2001, 12],
    looking_for: ['exploring', 'friends'],
    photos: ['pebble-0'],
  },
  {
    key: 'truffle',
    name: 'Truffle',
    pronouns: 'she/her',
    tagline: 'Small, spotty and here for a good time',
    bio: "Piglet with spots in all the right places. I love a muddy walk, a long nap and a really good snack, in any order. Contrary to rumours, I'm very clean, I just like to make an entrance. I'm new to all this and here to meet people who are kind, curious and up for an adventure, or at least a picnic. Oink is a full sentence.",
    gender: ['Woman'],
    sexuality: ['Queer'],
    born: [1998, 5],
    looking_for: ['casual', 'friends', 'exploring'],
    photos: ['truffle-0', 'truffle-1'],
  },
  {
    key: 'nutmeg',
    name: 'Nutmeg',
    pronouns: 'he/him',
    tagline: 'Ginger, fluffy, sometimes listens',
    bio: "Ginger cat. You may have heard things about ginger cats. They're all true. I have one brain cell and I share it generously with my housemates. I do my stretches against the garden fence every morning and I'd love some company for that. Looking for chin scratches, garden adventures and someone who'll open the door, then open it again thirty seconds later.",
    gender: ['Man'],
    sexuality: ['Bisexual'],
    born: [1989, 12],
    looking_for: ['polyamory', 'casual'],
    photos: ['nutmeg-0', 'nutmeg-1'],
  },
  {
    key: 'dolly',
    name: 'Dolly',
    pronouns: 'she/her',
    tagline: 'Will climb anything. Has climbed your shed.',
    bio: "Mountain goat, now living in London, where everything is disappointingly flat. I've climbed most of the walls in Hackney, at least one of them legally. I'm told I'm stubborn, which I prefer to call sure-footed. Looking for climbing partners, adventurous weekends away and someone to hold the snacks while I go up something I probably shouldn't.",
    gender: ['Woman'],
    sexuality: ['Lesbian'],
    born: [1986, 7],
    looking_for: ['open-relationship', 'exploring', 'Bouldering'],
    photos: ['dolly-0'],
  },
  {
    key: 'gumdrop',
    name: 'Gum Drop',
    pronouns: 'they/them',
    tagline: 'Sleeps 20 hours a day, makes the other 4 count',
    bio: "Koala, technically on a very long holiday from Australia. I sleep about twenty hours a day and I'm not sorry, it's a eucalyptus thing. When I'm awake I'm excellent company and very good at hugging things, mostly trees, but I'm open to suggestions. Looking for friends who like quiet evenings, plant-based dinners and not being rushed.",
    gender: ['Non-binary'],
    sexuality: ['Aromantic'],
    born: [1992, 10],
    looking_for: ['friends', 'relationship-anarchy'],
    photos: ['gumdrop-0'],
  },
  {
    key: 'squeak',
    name: 'Squeak',
    pronouns: 'any pronouns',
    tagline: 'Rare, fluffy and very busy',
    bio: "White squirrel, which apparently makes me rare. I don't feel rare, I feel busy. I have about four hundred nuts hidden around Victoria Park and I remember where maybe six of them are. Looking for people to explore new parks with, ideally ones with good trees. I'll be honest, I may get distracted halfway through your sentence. Ooh, a crisp.",
    gender: ['Genderfluid'],
    sexuality: ['Pansexual'],
    born: null,
    looking_for: ['exploring', 'casual', 'friends'],
    photos: ['squeak-0'],
  },
  {
    key: 'barnaby',
    name: 'Barnaby',
    pronouns: 'he/him',
    tagline: 'Big ears, good listener',
    bio: "Donkey, with ears built for listening. I've been told I'm a bit stubborn, but only because I've thought about it carefully. Big fan of fields, fences to lean on and long, honest conversations. My photo is a selfie, I haven't worked out the camera yet. Looking for gentle people and patient friendships that take their time.",
    gender: ['Man'],
    sexuality: ['Demisexual'],
    born: [1980, 4],
    looking_for: ['friends', 'polyamory'],
    photos: ['barnaby-0'],
  },
  {
    key: 'pompom',
    name: 'Pom Pom',
    pronouns: 'she/they',
    tagline: 'New here. Everything is amazing.',
    bio: "Papillon puppy, very new to everything, including this app, the world and my own feet. Everything is amazing. Grass? Amazing. You? Amazing. That leaf? Unbelievable. I'm still learning the rules, so be patient with me and I'll be the most enthusiastic friend you've ever had. Looking for playdates, people to learn from and lots of cuddles.",
    gender: ['Genderqueer'],
    sexuality: ['Questioning'],
    born: [2004, 6],
    looking_for: ['exploring', 'friends'],
    photos: ['pompom-0'],
  },
];

/**
 * The member to sign in as (prickles@demo.kitchentable.test): she has a conversation going and an
 * intro waiting.
 */
export const PRICKLES: CastMember = {
  key: 'prickles',
  name: 'Prickles',
  pronouns: 'she/they',
  tagline: 'Prickly outside, extremely soft inside',
  bio: "Hedgehog. I'm a bit spiky when you first meet me, but give it ten minutes and I'll be the one falling asleep on your lap. Night-time runner (short legs, big ambitions), slug enthusiast and big supporter of gaps under garden fences. Looking for running buddies, friends who like an evening walk and someone who'll leave a saucer of something out for me.",
  gender: ['Woman', 'Genderqueer'],
  sexuality: ['Queer'],
  born: [1994, 11],
  looking_for: ['friends', 'exploring', 'Running buddies'],
  photos: ['prickles-0', 'prickles-1', 'prickles-2'],
};

/** An intro to Prickles, waiting in her Connections tab. */
export const INTRO = {
  from: 'hoot',
  /** Must be from what Prickles is looking for. */
  looking_for: ['friends', 'exploring'],
  text: "Hello! I'm up at night too, and I've seen you trotting past my tree at two in the morning more than once. I won't pretend I can keep up (I'm more of a glider than a runner), but I can see the whole park from up there and I'm excellent at hooting encouragement. Fancy a night walk sometime? I know where all the best slugs are.",
};

/**
 * An accepted connection between Prickles (`me`) and a member, started by her intro (the first
 * message). `minutesAgo` is when each message was sent; Prickles has read everything up to
 * `readUpTo` messages, so the rest show as unread.
 */
export const CONVERSATION = {
  with: 'hammy',
  /** Must be from what the member is looking for. */
  looking_for: ['Wheel running', 'friends'],
  readUpTo: 6,
  messages: [
    {
      from: 'me',
      minutesAgo: 20 * 60,
      text: 'Hi Hammy! Fellow runner here. I manage about 5k on a good day, you do nine kilometres a night without going anywhere. I feel like we could learn a lot from each other. Also, I need to know more about the tiny chair.',
    },
    {
      from: 'them',
      minutesAgo: 19 * 60,
      text: "Hello! Thank you for reaching out. The chair is a long story. Short version: someone left it in my cage and now it's the best seat in the house.",
    },
    {
      from: 'them',
      minutesAgo: 19 * 60 - 1,
      text: "Also, 9k is a slow night. I'm training for a wheel marathon.",
    },
    {
      from: 'me',
      minutesAgo: 18 * 60 + 30,
      text: "A wheel marathon! That's commitment. Do you do any training outside the wheel?",
    },
    {
      from: 'them',
      minutesAgo: 18 * 60,
      text: "Sometimes I run inside a plastic ball around the living room. It's like a treadmill, but you can crash into the sofa.",
    },
    {
      from: 'me',
      minutesAgo: 5 * 60,
      text: "Okay, I'm impressed. Want to go for a slow run in the park this weekend? Snacks after, obviously.",
    },
    { from: 'them', minutesAgo: 25, text: 'Yes please!! Saturday morning?' },
    {
      from: 'them',
      minutesAgo: 24,
      text: "I'll bring sunflower seeds. Most of them will be in my cheeks, but I'll share some 🌻",
    },
  ],
};

/** Applications waiting in /admin/vetting. */
export const APPLICANTS: Applicant[] = [
  {
    key: 'bandit',
    name: 'Bandit',
    pronouns: 'he/they',
    tagline: 'Here for the community, not the bins',
    bio: "Raccoon. I know how this looks, but I'm genuinely here to make friends. I have very clever hands, a great sense of humour and a mask I can't take off, which makes me an excellent listener at parties because nobody can tell if I'm judging them (I'm not). Looking for night-time adventures and people who don't lock their snacks away.",
    gender: ['Man', 'Non-binary'],
    sexuality: ['Bisexual'],
    born: [1993, 2],
    looking_for: ['friends', 'exploring', 'casual'],
    photos: ['bandit-0'],
    vetting_answers: {
      consent:
        "Consent means asking first and really listening to the answer, even if the answer is 'no, you may not have my chips'. It's only a yes if it's given freely, and anyone can change their mind at any point, including about the chips.",
      guidelines:
        "Be kind, be honest and respect people's boundaries (and their bins). Check in with each other, say what you need clearly and never share what someone told you in confidence.",
      invite_code: 'DEMO-INVITE',
      onboarding_feedback: 'Very smooth! A dark mode for night-time browsing would be lovely.',
    },
  },
  {
    key: 'puddle',
    name: 'Puddle',
    pronouns: 'they/them',
    tagline: 'Just learned to swim. Mostly in sinks.',
    bio: "Duckling, three weeks into life and loving it so far. I've mastered paddling, I'm working on flying and I've already made friends with a rubber duck who doesn't say much. I follow people around quite a lot, so tell me if it's too much. Looking for kind people, calm ponds and someone who knows where the good bread is (it's not bread, I've been told, it's peas).",
    gender: ['Gender questioning'],
    sexuality: [],
    born: null,
    looking_for: ['friends', 'exploring'],
    photos: ['puddle-0'],
    vetting_answers: {
      consent:
        'Consent is when everyone involved says yes because they want to, not because they feel they have to. You ask, you wait for the answer, and you keep checking in, because people (and ducklings) can change their minds.',
      guidelines:
        'Look after each other, be patient with people who are new (like me), respect privacy and treat everyone the way you would want to be treated at the pond.',
      invite_code: 'DEMO-INVITE',
    },
  },
  {
    key: 'ribbit',
    name: 'Ribbit',
    pronouns: 'any pronouns',
    tagline: 'Looking for my lily pad people',
    bio: "Frog. I sit on rocks and think about things, and every now and then I jump. I've been told I'm a bit of a croaker in the mornings but I'm lovely by lunchtime. I'm into ponds, rainy days and the kind of conversation that goes on for hours without anyone noticing. Looking for a warm community and maybe someone to share a lily pad with.",
    gender: ['Agender'],
    sexuality: ['Pansexual'],
    born: [1990, 9],
    looking_for: ['polyamory', 'relationship-anarchy', 'friends'],
    photos: ['ribbit-0'],
    vetting_answers: {
      consent:
        'Consent is an enthusiastic, informed and ongoing yes. It means talking openly about what everyone wants, respecting a no straight away and never assuming that a yes yesterday means a yes today.',
      guidelines:
        "Honesty, kindness and discretion. Respect everyone's boundaries and relationships, communicate openly, and remember there's a real person (or frog) behind every profile.",
      invite_code: 'DEMO-INVITE',
      onboarding_feedback: 'The photo cropping was easy even with webbed fingers.',
    },
  },
];
