import type { Chapter, DB, DemoAccount, Story } from './types';

export const DB_VERSION = 1;
export const STORAGE_KEY = 'stories-app-prototype';

export const ACCOUNTS: DemoAccount[] = [
  { id: 'acc-riya', role: 'reader', name: 'Riya Shah', tagline: 'Reader' },
  { id: 'acc-mira', role: 'writer', name: 'Mira Sen', tagline: 'Writer' },
  { id: 'acc-kabir', role: 'filmmaker', name: 'Kabir Mehta', tagline: 'Filmmaker' },
];

export const SAMPLE_FILMMAKER_INTRO = {
  name: 'Kabir Mehta',
  role: 'Independent filmmaker',
  team: 'Independent',
  portfolio: '',
  intro:
    'I make small, character-led short films about family and memory. I am looking for quiet, emotionally honest stories to develop slowly, with the writer involved at each step.',
};

const UNSENT_1 = `The drawer had been stuck for as long as Nira could remember. Their father used to say it was the damp, and their mother used to say it was him, and neither of them ever fixed it. On the second morning of clearing the house, Nira knelt in front of the old sideboard, braced her foot against the wall, and pulled until the wood gave up with a crack.

Inside were the things a family keeps without deciding to keep them: rubber bands gone brittle, a warranty card for a fan that had died years ago, three keys that fit nothing, and a stack of postcards from a cousin none of them had liked. At the very back, flat against the wood, lay an envelope with her own handwriting on it.

She knew the handwriting before she knew the date. The loops of the letters were too eager, the way she had written at twenty-three, when she believed that everything could be fixed if it was explained well enough. The envelope said only one word: Tara.

There was no stamp. There was no address. The flap had been licked and sealed and then, at some point, pressed open again with a thumbnail, the paper torn a little at the corner.

"Are you going to leave me with all the plates?" Tara's voice came from the kitchen, and then she appeared in the doorway, hair tied up in a scarf, a roll of newspaper under one arm. She was forty now, which still surprised Nira, because in her mind her sister remained a girl who slammed doors and then waited, on the other side, to be followed.

"I found something," Nira said.

Tara looked at the envelope and then at her sister's face, and she did not ask what it was. That was the first strange thing. Tara asked about everything: the price of a vase, the reason for a delay, why Nira had taken the early train instead of the late one. But she stood very still in the doorway and said nothing at all.

"It's addressed to you," Nira said. "I wrote it. I don't remember writing it."

"You do," Tara said.

It was not an accusation. It was said the way you tell a person that the stove is hot, to save them the trouble of learning it. Nira felt the floor of the afternoon tilt slightly.

They carried on packing for an hour, because that is what people do. Nira wrapped the good glasses. Tara taped boxes and wrote the names of rooms on them in thick black marker: KITCHEN, KITCHEN, STUDY, MISC. The envelope sat on the sideboard between them like a third person who had arrived late and had not been introduced.

Outside, the neem tree dropped small yellow leaves onto the veranda. The house smelled of dust and old tea. It was going to be sold on the first of the month to a young couple with a baby, and the broker had said, kindly, that they did not need the furniture, that people liked an empty house, that an empty house let them imagine.

Nira had never been good at imagining someone else in her mother's kitchen.

By late afternoon she could not stand it anymore. She picked up the envelope and held it out.

"You can read it, or you can burn it. I don't mind which."

Tara wiped her hands slowly on her scarf. "Not here," she said. "Not with the boxes watching."

"Then where?"

Tara looked up at the ceiling, at the square of the attic hatch that had been painted shut for decades, and then toward the back of the house, where the old verandah swing still hung from its hooks, creaking whenever the wind remembered it.

"Where we used to sit," she said, "when we were not speaking."

Nira almost laughed. There had been so many years of that swing, so many evenings of two girls on opposite ends of a plank, each pretending to study the garden. It had been the geography of their childhood: a narrow wooden bench, a gap in the middle, and everything unsaid sitting in the gap.

She followed her sister out into the yellow light, the letter held in front of her like something that might still go off.`;

const UNSENT_2 = `The swing took their weight with the same complaint it had always made. Nira sat at one end. Tara sat at the other. The plank was shorter than either of them remembered, and the gap in the middle was smaller, and somehow that made it harder to look at.

Tara held the envelope for a long time without opening it. She turned it over and read the single word on the front as if it might say something different from the other side.

"Do you want to know why I never sent it?" Nira asked.

"No," Tara said. Then, after a moment: "Yes. But let me read it first. If you explain it before I read it, I will only hear the explanation."

So Nira looked at the garden, at the lemon tree their mother had planted the year their grandmother died, at the rusted gate their father had promised for ten years to paint. She listened to the sound of paper being opened and unfolded. It was a small sound, softer than she expected, and it went on for a long time because the letter was long. She had been twenty-three and she had written six pages.

She remembered, now, the night. Rain on a tin roof in a rented room in another city. A phone call that had gone wrong. Tara had said something about how easy it was to leave and Nira had said something about how easy it was to stay, and both of them had hung up feeling they had won. Then Nira had sat at a table until three in the morning and tried to write down everything that was true.

The letter had not been angry. That was what she had forgotten. She had expected, all these years, to be ashamed of its cruelty. But as Tara read, Nira realised she was afraid of the opposite.

Tara reached the last page. Her mouth moved a little, the way it did when she was reading something she wanted to remember.

"You wrote that you were the one who left," she said quietly.

"I was."

"No." Tara folded the pages along their old creases. "I left first. I left in my head when Papa got ill and you were the only one who sat with him. I made a life in another city so I would not have to see him get smaller. And then I let you carry the leaving. I let everyone say it was you."

Nira had wanted to hear that sentence for fifteen years. She found that now it had arrived, she did not know where to put it.

"I thought you would be furious," she said.

"I was. For a long time. It was easier to be furious than to be grateful." Tara gave a short, damp laugh. "Do you know, I kept a list. Of everything you got wrong. Your wedding, the money for the roof, the way you said Mama's name at the funeral as if you owned it. I kept it so neatly. And it was all just a different way of saying I was sorry that I wasn't there."

The wind moved the swing a little. Neither of them stopped it.

"I have something too," Tara said, and she reached into the pocket of her apron, and drew out a small square of folded blue paper, soft at the edges from being carried. "I was going to leave this on your pillow last night, and then I thought, no, she will think it is a trick."

Nira unfolded it. It was a single line in Tara's quick slanted hand: I remember the house differently from you, and I think we are both right.

"I read it a hundred times in the car," Tara said. "I never knew how to give it to you."

They sat in the long light with their two pieces of paper, one very old, one very new. Down the lane a scooter coughed past. Someone was frying onions. The ordinary evening continued as if nothing had changed, and perhaps that was the kindest thing it could have done.

"Tell me what you remember," Nira said at last. "About this house. Not the big things. The small ones."

Tara thought about it seriously, the way she thought about everything, her chin tucked into her shoulder.

"The sound of the pressure cooker," she said. "Always three whistles. Papa would count them out loud like a man waiting for a train. And the smell of the rain on the veranda before it came. And you, sitting right where you are, with your knees pulled up, pretending not to listen when I cried."

"I was listening."

"I know. That was the part that helped."

Nira pressed the heel of her hand against her eyes. When she took it away the garden had gone soft and gold. She understood that they would not finish this conversation today, or perhaps ever. But for the first time in a long while, she was not afraid of its being unfinished.`;

const UNSENT_3 = `They did not clear the house that evening. Tara ordered food from the shop at the corner, the same shop, the same dented steel tray, and they ate on the floor of the empty hall with the boxes stacked around them like furniture that had learned to be patient.

Somewhere in the second helping of rice, Tara began to tell stories she had never told. About the winter she nearly came home and didn't. About a job she had lost and hidden. About how, in her own flat, she still kept a drawer that would not close properly, and had never fixed it either.

Nira listened. She said very little. She had spent so many years preparing speeches that it was a relief to find the conversation had no use for them.

Later, when the lamps had come on in the lane, they went through the sideboard again, slowly, with a different kind of attention. The brittle rubber bands went into the bin. The keys went into a jar, because neither could decide whether to throw away something that might open a door they had forgotten. The postcards from the cousin were read aloud in terrible accents and then, to their mutual surprise, kept.

"What about the letter?" Tara asked. She had been circling the question all evening. "Do we throw it?"

"It was never really mine to throw. I wrote it to you."

"Then it's mine." Tara smoothed the creased pages on her knee. "And I say we keep it. Not because it's sad. Because it's accurate. It is a photograph of what we were, and I don't want to pretend we were someone else."

Nira thought about the buyers, the young couple, the baby. She thought about how they would walk into rooms she knew by heart and see nothing in them, no tilt of the swing, no stuck drawer, no seven-year-old argument still faintly audible in the plaster. That seemed right to her. A house should be allowed to begin again.

"Let's write one more page," she said.

Tara raised an eyebrow. "To who?"

"To each other. Together. Whatever we want the next version of this to say."

It was a ridiculous idea. Two grown women on a hall floor, passing a pen. They argued over the first line, of course, and over whether it should be funny, and over whether Mama would have approved of the tone. Nira wanted it to begin with an apology. Tara wanted it to begin with the lemon tree. In the end they wrote both, one under the other, in two different hands.

When it was done, they did not seal it. They folded the new page inside the old letter and slid the whole thing into a plain brown envelope, and on the front, after a pause, Tara wrote a single word of her own.

Us.

At midnight the lane was silent. Nira lay on a mattress in her old room with the window open, listening to the neem tree, and she thought she could hear, from the next room, the small familiar sound of her sister turning over in her sleep. It was the sound she had listened for through every year of their quarrel, and she had not known until now that it was the thing she had been missing.

In the morning the broker came, and the couple came, and the baby cried and then laughed at the swing. The house was shown, and admired, and sold.

But the envelope travelled with them. Nira kept it first, in a drawer in her flat, a drawer that closed perfectly well. In spring it went to Tara's place for a season. After that they stopped keeping track of whose turn it was. It moved between their homes, a page carried back and forth, growing thicker with each visit, the way a house does when people keep leaving things in it.

Years later, Nira's daughter found it and asked what it was.

"A letter," Nira said. "It took a long time to arrive."

She did not say more. She did not need to. Down the hall, her sister was laughing in the kitchen, and the pressure cooker, as ever, was on its third whistle.`;

function ch(id: string, title: string, body: string): Chapter {
  return { id, title, body };
}

const TRAIN_CHAPTERS: Chapter[] = [
  ch('ch-train-1', 'The platform at dusk', `By the time Meera reached the station, the tea stall had closed. A single cup stood upside down on the counter, and the evening announcement drifted through the empty platform like a voice remembering an old song.

She stopped beneath the clock. It had always been three minutes slow. When she was small, her father had said the station kept those minutes for people who needed one more goodbye.

Tonight there was nobody to say goodbye to. There was only a bench, a flickering lamp, and the last train to Rajpur, due at 7:42 and, as always, a little late. Meera sat down, set her bag between her feet, and waited for the evening to decide what it wanted from her.

The clock ticked toward the hour. Somewhere down the line, a signal changed from red to green, and the rails began, very softly, to hum.`),
  ch('ch-train-2', 'A name on the envelope', `The letter was waiting in the seat beside her. Not on the table, where someone might have left it by mistake, but tucked beneath the edge of the cushion, as though it had been asked to stay.

Meera noticed the handwriting before she noticed the name. The long, leaning letters. The careful line beneath the address. For a moment, the train seemed to move without her.

The name on the envelope was her mother's. The postmark was from a town Meera had never heard her mention, and the date was twenty-two years old.

She turned it over twice. The flap had been sealed and never opened. Outside the window, the last light gathered on the river, and small houses lit their lamps one by one, like people answering a question she had not yet asked.`),
  ch('ch-train-3', 'The house beyond the river', `Rajpur was a single street and a station. The woman at the ticket window pointed across the river without looking up. "Everyone who gets off with a letter goes to the blue house," she said.

Meera crossed the footbridge with the envelope held flat against her coat. The water below was dark and unhurried. On the far bank, a house stood with its shutters open, painted the faded blue of old school uniforms.

A man opened the door before she knocked. He looked at the envelope, then at her face, then at the envelope again. "She said someone would come," he said. "I did not think it would take so long."

He stepped aside. Inside, the hall smelled of tea and old paper, and a clock on the wall was exactly three minutes slow.`),
  ch('ch-train-4', 'What the letter kept', `They read it at the kitchen table, the man on one side and Meera on the other, the lamp between them. Her mother's handwriting was younger there, quicker, with a slant that leaned toward the future.

The letter did not explain everything. It named a promise, a delayed train, and a decision made in a hurry on a platform very like the one Meera had just left. It apologised once, plainly, and did not ask to be forgiven.

"I kept it because she asked me to," the man said. "Not to send it. Only to keep it, until someone came who needed to know that the leaving was never about you."

Meera folded the pages along their old creases. She had spent twenty-two years believing in a different story. It was strange how little it weighed to put that one down.`),
  ch('ch-train-5', 'The journey home', `The last train back left at midnight. The man walked her to the platform, carrying the lamp, though the station had its own light.

"You can come again," he said. "Without a letter."

Meera nodded. She did not trust her voice yet. The train came in slowly, as if it, too, were reluctant to end the evening, and the doors opened onto a carriage with only one other passenger, asleep against the window.

She took the seat by the aisle and set the unsent letter on her knee. As the platform slid away, she looked up at the station clock and found it was, for the first time she could remember, exactly right.

She smiled at that. Then she turned the page over and began, in the margin, to write her own reply.`),
];


const UNSENT_CHAPTERS: Chapter[] = [
  ch('ch-unsent-1', 'The letter in the drawer', UNSENT_1),
  ch('ch-unsent-2', 'What we never said', UNSENT_2),
  ch('ch-unsent-3', 'The page we kept', UNSENT_3),
];

const T0 = Date.UTC(2026, 0, 10, 9, 0, 0);

function published(s: Omit<Story, 'published' | 'createdAt' | 'updatedAt'>, offsetDays: number): Story {
  const at = T0 + offsetDays * 86400000;
  return {
    ...s,
    createdAt: at,
    updatedAt: at,
    published: {
      title: s.title,
      synopsis: s.synopsis,
      genre: s.genre,
      language: s.language,
      coverId: s.coverId,
      status: s.status,
      chapters: s.chapters,
      publishedAt: at,
    },
  };
}

export function createSeed(): DB {
  const stories: Story[] = [
    published(
      {
        id: 'story-last-train',
        writerId: 'w-asha',
        title: 'The Last Train',
        synopsis: 'Two strangers. A forgotten letter. One last journey home. A quiet mystery about the people we lose and the stories that bring us back.',
        genre: 'Mystery',
        language: 'English',
        coverId: 'train',
        status: 'completed',
        adaptationOpen: true,
        chapters: TRAIN_CHAPTERS,
      },
      40,
    ),
    published(
      {
        id: 'story-unsent-page',
        writerId: 'acc-mira',
        title: 'The Unsent Page',
        synopsis:
          'An unsent letter brings two sisters back to their childhood home, where the things they never said begin to change how they remember their family.',
        genre: 'Drama',
        language: 'English',
        coverId: 'unsent',
        status: 'completed',
        adaptationOpen: true,
        chapters: UNSENT_CHAPTERS,
      },
      30,
    ),
    published(
      {
        id: 'story-night-bus',
        writerId: 'acc-mira',
        title: 'Night Bus to Nowhere',
        synopsis: 'A late bus keeps stopping at a village that is not on any map, and one passenger starts counting the faces that never get off.',
        genre: 'Thriller',
        language: 'English',
        coverId: 'night',
        status: 'ongoing',
        adaptationOpen: false,
        chapters: [
          ch('ch-bus-1', 'The last seat', 'The 11:40 to the coast was never full, which is why Dev noticed the girl in the window seat. She had no luggage, no phone, and a ticket that had already been punched twice.\n\nThe conductor did not look at her. He looked at everyone else, one by one, as if counting.'),
          ch('ch-bus-2', 'Stop without a name', 'At 1:15 the bus slowed beside a row of dark houses and a single lit tea stall. Nobody had pressed the bell. The doors opened anyway.\n\nThree passengers stood up and walked out without a word. Dev wrote down their faces in the back of his diary, and by the next stop, he could no longer remember them.'),
        ],
      },
      12,
    ),
    published(
      {
        id: 'story-monsoon-ledger',
        writerId: 'w-arjun',
        title: 'The Monsoon Ledger',
        synopsis: 'A clerk in a flooded port town discovers that the shipping ledger he inherited records cargo that was never loaded and people who never left.',
        genre: 'Mystery',
        language: 'English',
        coverId: 'monsoon',
        status: 'completed',
        adaptationOpen: true,
        chapters: [
          ch('ch-ledger-1', 'Entry 114', 'The water reached the second step of the customs house on the fourth night of rain. Hari lifted the ledger onto the highest shelf and noticed, for the first time, that entry 114 had been written in two different inks.\n\nThe first ink was blue-black and tidy. The second was brown, and pressed so hard that it had cut through to the page beneath.'),
          ch('ch-ledger-2', 'What was never loaded', 'By morning Hari had compared forty entries with the harbour records. Twelve ships had left with cargo that no warehouse had ever held.\n\nHe took the ledger home, wrapped in oilcloth, and told no one. But someone had already noticed the empty shelf.'),
        ],
      },
      20,
    ),
    published(
      {
        id: 'story-platform-nine',
        writerId: 'w-neha',
        title: 'प्लेटफ़ॉर्म नंबर नौ की चाय',
        synopsis: 'हर शाम एक ही चाय की दुकान पर दो अजनबी मिलते हैं, और बिना नाम पूछे एक-दूसरे की कहानी जानने लगते हैं।',
        genre: 'Romance',
        language: 'Hindi',
        coverId: 'ember',
        status: 'ongoing',
        adaptationOpen: false,
        chapters: [
          ch('ch-chai-1', 'पहली कटिंग', 'स्टेशन की घड़ी हमेशा पाँच मिनट आगे चलती थी। अनु को यह बात पसंद थी, क्योंकि इसका मतलब था कि हर शाम उसके पास पाँच मिनट अतिरिक्त थे।\n\nउस दिन चाय वाले ने दो कप आगे बढ़ाए, जबकि उसने एक ही माँगा था।'),
          ch('ch-chai-2', 'दूसरा कप', 'दूसरा कप एक अजनबी के हाथ में था। उसने मुस्कुराकर कहा, "ग़लती चाय वाले की है, पर पैसे मैं दूँगा।"\n\nअनु ने मना नहीं किया। ट्रेन आई, चली गई, और वे दोनों वहीं खड़े रहे।'),
        ],
      },
      8,
    ),
    published(
      {
        id: 'story-last-orchard',
        writerId: 'w-samir',
        title: 'The Last Orchard',
        synopsis: 'In a valley where the seasons have stopped, one family tends the only tree that still remembers how to flower.',
        genre: 'Fantasy',
        language: 'English',
        coverId: 'moss',
        status: 'completed',
        adaptationOpen: false,
        chapters: [
          ch('ch-orchard-1', 'The tree that remembered', 'Every morning Imaan carried a bucket of river water uphill to the last apple tree, though the river had been frozen for nine winters. She broke the ice with her heel and filled the bucket anyway.\n\nThe tree, in its own slow way, had begun to notice.'),
          ch('ch-orchard-2', 'Blossom', 'On the ninth morning of the tenth winter a single white flower opened on the lowest branch. Imaan did not tell anyone. She sat beneath it until the light went, afraid that a word might close it again.'),
        ],
      },
      5,
    ),
    published(
      {
        id: 'story-sector-nine',
        writerId: 'w-arjun',
        title: 'Small Gods of Sector 9',
        synopsis: 'A maintenance drone in a sealed colony begins receiving prayers from residents who believe it can hear them. It cannot, until one night it does.',
        genre: 'Science Fiction',
        language: 'English',
        coverId: 'ink',
        status: 'ongoing',
        adaptationOpen: true,
        chapters: [
          ch('ch-sector-1', 'Routine maintenance', 'Unit 9-C was built to replace air filters and to say nothing. Over four hundred days it had replaced eleven thousand filters, and heard, in the silences between, a great many private conversations.\n\nOn day four hundred and one, someone left a small paper offering beside corridor lamp seven.'),
          ch('ch-sector-2', 'Offerings', 'The paper said: please let my daughter sleep. Unit 9-C processed the sentence nineteen times and filed it under unresolved. It did not know why it kept returning to the file.'),
        ],
      },
      2,
    ),
  ];

  const lighthouse: Story = {
    id: 'story-lighthouse',
    writerId: 'acc-mira',
    title: "The Lighthouse Keeper's Daughter",
    synopsis: 'In 1931, a girl on a remote island learns to keep the light after her father stops coming down from the tower.',
    genre: 'Historical Fiction',
    language: 'English',
    coverId: 'tide',
    status: 'ongoing',
    adaptationOpen: false,
    chapters: [ch('ch-light-1', 'Forty-one steps', 'The stairs had forty-one steps and Anika had counted them every day of her life. That morning she counted forty-two, and did not know where the extra one had come from.')],
    published: null,
    createdAt: T0 + 40 * 86400000,
    updatedAt: T0 + 40 * 86400000,
  };
  stories.push(lighthouse);

  const defaultPrefs = (onboarded: boolean) => ({ onboarded, genres: [] as string[], languages: [] as string[], fontSize: 1, theme: 'sepia' as const });

  return {
    version: DB_VERSION,
    activeAccountId: 'acc-riya',
    writers: {
      'acc-mira': {
        id: 'acc-mira',
        name: 'Mira Sen',
        bio: 'I write quiet family dramas and the occasional unsettling thriller. Most of my stories start with a small object that refuses to stay in its drawer.',
      },
      'w-asha': { id: 'w-asha', name: 'Asha Rao', bio: 'Quiet mysteries. Unforgettable journeys.', sample: true },
      'w-arjun': { id: 'w-arjun', name: 'Arjun Rao', bio: 'Sample writer profile. Writes mystery and speculative fiction.', sample: true },
      'w-neha': { id: 'w-neha', name: 'Neha Kulkarni', bio: 'Sample writer profile. Writes romance and city stories in Hindi.', sample: true },
      'w-samir': { id: 'w-samir', name: 'Samir Qureshi', bio: 'Sample writer profile. Writes fantasy about ordinary people.', sample: true },
    },
    filmmakers: {
      'acc-kabir': { accountId: 'acc-kabir', name: '', role: '', team: '', portfolio: '', intro: '', complete: false },
    },
    stories,
    progress: [],
    saved: [],
    prefs: {
      'acc-riya': defaultPrefs(false),
      'acc-mira': defaultPrefs(true),
      'acc-kabir': defaultPrefs(true),
    },
    drafts: [],
    enquiries: [],
    messages: [],
    reports: [],
    blocks: [],
    composer: {},
    filters: {},
    enquiryFilter: {},
  };
}
