export const SEED_VERSION = "1.0.0";
export const SEED_SOURCE = "arise-production-seed";

const base = (slug, order, extra = {}) => ({
  slug,
  order,
  status: "PUBLISHED",
  isActive: true,
  source: SEED_SOURCE,
  seedVersion: SEED_VERSION,
  systemContent: true,
  ...extra,
});

export const masters = [
  ["mindful-awareness", "Mindful Awareness", "mind", "Notice the thought before it becomes the pattern", "mind"],
  ["identity-repetition", "Identity Through Repetition", "repeat", "Small repeated actions become believable evidence", "science"],
  ["conscious-leadership", "Conscious Leadership", "compass", "Lead from clarity before urgency", "mind"],
  ["inner-discipline", "Inner Discipline", "fire", "Return to what matters when mood changes", "mind"],
  ["receiving-capacity", "Receiving Capacity", "heart", "Let support, value, and appreciation land", "mind"],
  ["energy-stewardship", "Energy Stewardship", "shield", "Protect attention as a serious resource", "science"],
  ["gratitude-and-result", "Gratitude and Result", "gratitude", "Train attention to recognize what is already working", "ancient"],
  ["reflective-action", "Reflective Action", "target", "Insight becomes useful when it changes a choice", "mind"],
].map(([slug, name, icon, tagline, tradition], index) => {
  const action = index % 2 === 0 ? "Name the pattern" : "Choose the clean action";
  const title = index % 2 === 0 ? "Three-Minute Witness" : "Evidence List";
  const exercises = [
    {
      title,
      description: `A short ARISE practice for ${name.toLowerCase()}.`,
      durationMinutes: index % 2 === 0 ? 3 : 7,
      steps: ["Sit upright.", action, "Take three steady breaths.", "Record one honest observation."],
    },
    {
      title: "Insight to Action",
      description: "Convert reflection into one visible next step.",
      durationMinutes: 5,
      steps: ["Write the insight.", "Ask what it requires.", "Choose one action.", "Complete it today."],
    },
  ];

  return {
    ...base(slug, index + 1, { featured: index < 3 }),
    name,
    icon,
    tagline,
    tradition,
    exerciseCount: exercises.length,
    exercises,
  };
});

export const asanas = [
  ["mountain-pose", "Tadasana", "tree", "Standing grounding pose - 6 steady breaths", ["ground", "morning"], 6, "Stand tall, soften knees, lengthen spine, and breathe evenly."],
  ["warrior-two", "Virabhadrasana II", "strength", "Standing strength pose - 5 breaths each side", ["confidence", "morning"], 5, "Keep the front knee tracking gently and relax the shoulders."],
  ["tree-pose", "Vrksasana", "balance", "Balance practice - 5 breaths each side", ["focus", "balance"], 5, "Use a wall if helpful. Place the foot below or above the knee, not on it."],
  ["childs-pose", "Balasana", "rest", "Restorative pause - 8 slow breaths", ["calm", "clarity"], 8, "Rest the torso comfortably and stop if the knees feel strained."],
  ["cat-cow", "Marjaryasana Bitilasana", "wave", "Spinal mobility - 8 gentle rounds", ["mobility", "morning"], 8, "Move slowly with the breath and avoid forcing the range."],
  ["seated-twist", "Ardha Matsyendrasana Prep", "spiral", "Seated twist - 5 breaths each side", ["clarity", "mobility"], 5, "Lengthen before twisting and keep the breath easy."],
  ["cobra-pose", "Bhujangasana", "leaf", "Gentle backbend - 5 breaths", ["open_heart", "energy"], 5, "Keep elbows soft and stop if the lower back pinches."],
  ["forward-fold", "Uttanasana", "fold", "Release fold - 6 breaths", ["release", "ground"], 6, "Bend knees generously and let the neck relax."],
  ["low-lunge", "Anjaneyasana Prep", "moon", "Hip opening lunge - 5 breaths each side", ["mobility", "energy"], 5, "Pad the back knee and stay out of pain."],
  ["chair-pose", "Utkatasana", "fire", "Activation pose - 5 breaths", ["discipline", "morning"], 5, "Sit back lightly and keep the breath steady."],
  ["bridge-pose", "Setu Bandha Sarvangasana", "bridge", "Grounded backbend - 6 breaths", ["open_heart", "restore"], 6, "Lift gently and keep the neck neutral."],
  ["legs-up-rest", "Viparita Karani Prep", "restore", "Restorative inversion - 10 breaths", ["restore", "evening"], 10, "Use a wall or chair and come out slowly."],
  ["easy-seat", "Sukhasana", "meditate", "Meditation seat - 10 breaths", ["meditation", "calm"], 10, "Sit on support if the hips feel tight."],
  ["side-stretch", "Seated Side Stretch", "side", "Side body opening - 5 breaths each side", ["mobility", "breath"], 5, "Keep both sitting bones grounded and breathe into the ribs."],
  ["downward-dog-prep", "Adho Mukha Svanasana Prep", "triangle", "Whole body wake-up - 5 breaths", ["morning", "strength"], 5, "Bend knees and prioritize length over depth."],
  ["constructive-rest", "Constructive Rest", "moon", "Nervous-system pause - 12 breaths", ["restore", "evening"], 12, "Lie down with knees bent and let the floor support you."],
].map(([slug, name, icon, subtitle, intentTags, breathCount, cueText], index) => ({
  ...base(slug, index + 1, { featured: index < 4 }),
  name,
  icon,
  subtitle,
  intentTags,
  breathCount,
  cueText,
}));

export const breathwork = [
  ["box-breathing", "Box Breathing", "box", "4 in, 4 hold, 4 out, 4 hold for a calm reset.", 4, 4, "Inhale for four, hold gently, exhale for four, hold softly. Stop if uncomfortable."],
  ["equal-breathing", "Equal Breathing", "balance", "Balanced inhale and exhale for steady attention.", 5, 8, "Breathe in and out for the same count. Keep the breath quiet and unforced."],
  ["extended-exhale", "Extended Exhale", "leaf", "Longer exhale to encourage a reflective pause.", 6, 6, "Inhale naturally, then exhale slightly longer. Never strain the breath."],
  ["four-six-breath", "4-6 Breathing", "wind", "Inhale four, exhale six for evening calm.", 6, 6, "Let the exhale be smooth rather than dramatic."],
  ["coherent-breath", "Coherent Breathing", "circle", "Slow rhythmic breathing for centered focus.", 5, 10, "Breathe at a comfortable slow rhythm with relaxed shoulders."],
  ["morning-energizing", "Morning Energizing Breath", "bolt", "Gentle activation without intense retention.", 3, 12, "Use clear nasal breaths and stop if dizzy."],
  ["calming-evening", "Calming Evening Breath", "moon", "A softer rhythm for closing the day.", 4, 8, "Exhale with ease and let the jaw unclench."],
  ["three-breath-reset", "Three-Breath Reset", "target", "A quick reset before a decision.", 3, 3, "Take three deliberate breaths before choosing the next action."],
  ["gratitude-breath", "Gratitude Breath", "gratitude", "Pair breath with one specific appreciation.", 4, 6, "Name one real support in your life as you breathe."],
  ["focus-breath", "Focus Breath", "compass", "A practical rhythm before deep work.", 5, 6, "Breathe steadily and choose one task before opening your eyes."],
].map(([slug, name, icon, subtitle, rounds, breathsPerRound, guidanceText], index) => ({
  ...base(slug, index + 1, { featured: index < 3 }),
  name,
  icon,
  subtitle,
  rounds,
  breathsPerRound,
  guidanceText,
}));

const affirmationCategories = {
  belief: ["I can examine a belief without becoming it.", "I choose thoughts that support wise action.", "My inner story can mature with evidence.", "I notice old scripts and practice a cleaner one.", "I am allowed to update what I once assumed."],
  health: ["I make choices that respect my body today.", "I listen to my body with patience and care.", "I support my energy through simple consistent actions.", "I can rest without earning it first.", "I build health through honest daily stewardship."],
  wealth: ["I create value with clarity and receive with steadiness.", "I can handle money with calm attention.", "I practice receiving without shrinking.", "I let aligned action support my financial growth.", "I respect money as a responsibility, not a measure of worth."],
  happiness: ["I make room for ordinary moments of ease.", "Joy can be simple and still be real.", "I do not postpone peace until every problem is solved.", "I notice what is working without denying what needs care.", "I let small appreciation change the tone of my day."],
  purpose: ["I can serve the next step before seeing the whole path.", "Purpose grows through honest participation.", "My attention belongs to what matters.", "I do meaningful work one clean action at a time.", "I let contribution guide my ambition."],
  confidence: ["I trust myself to learn in motion.", "I can be new at something and still be worthy.", "I take the next brave step without performing certainty.", "My confidence grows from kept promises.", "I can act while still feeling human."],
  leadership: ["I lead with clarity before control.", "I can be direct without losing kindness.", "I take responsibility for the energy I bring.", "I make decisions from values, not panic.", "My leadership improves when I listen well."],
  focus: ["I return to one thing with patience.", "My attention strengthens when I protect it.", "I can finish what matters before chasing novelty.", "I choose depth over scattered urgency.", "I give this moment the dignity of my presence."],
  gratitude: ["I recognize support that I used to overlook.", "Gratitude makes me more available to life.", "I can appreciate progress before it is complete.", "I receive today with open eyes.", "I let appreciation become action."],
  discipline: ["I keep one promise today.", "I can start before motivation arrives.", "Discipline is care for my future self.", "I choose the useful action over the familiar delay.", "I return without drama when I drift."],
};

export const affirmations = Object.entries(affirmationCategories).flatMap(([category, texts], categoryIndex) =>
  texts.flatMap((text) => [text, text.startsWith("I ") ? text.replace("I ", "Today I ") : `Today, ${text.charAt(0).toLowerCase()}${text.slice(1)}`]).map((text, index) => ({
    ...base(`${category}-affirmation-${index + 1}`, categoryIndex * 20 + index + 1),
    text,
    category,
    tags: [category],
  }))
);

const quoteCategories = ["belief", "behaviour", "pattern", "result", "morning", "evening", "focus", "leadership", "wealth", "gratitude"];
const quoteTexts = [
  "Small actions become identity when repeated with intention.",
  "The next honest choice is often more useful than the last perfect plan.",
  "A pattern loses power when it is seen clearly and met consistently.",
  "Results become clearer when attention stops scattering itself.",
  "The morning does not need drama; it needs a clean beginning.",
  "Close the day by learning from it, not arguing with it.",
  "Focus is a form of respect for what matters.",
  "Leadership begins with the state you bring into the room.",
  "Receiving expands when responsibility grows with it.",
  "Gratitude is attention returning to support.",
  "Your old story may be familiar without being final.",
  "Behaviour is belief made visible for a moment.",
  "Repetition quietly teaches the self what to expect.",
  "Progress often arrives first as a calmer response.",
  "A deliberate breath can interrupt an inherited reaction.",
  "Discipline is less severe when it is rooted in care.",
  "Clarity grows when competing signals are reduced.",
  "The body often notices truth before the mind explains it.",
  "One kept promise can change the tone of a day.",
  "The result is feedback, not a verdict on your worth.",
];

export const quotes = Array.from({ length: 100 }, (_, index) => ({
  ...base(`arise-reflection-${index + 1}`, index + 1, { featured: index < 10 }),
  text:
    index < quoteTexts.length
      ? quoteTexts[index]
      : `${quoteTexts[index % quoteTexts.length]} Practice ${Math.floor(index / quoteTexts.length) + 1}: meet it in a new moment.`,
  author: "ARISE Reflection",
  category: quoteCategories[index % quoteCategories.length],
  tags: [quoteCategories[index % quoteCategories.length]],
}));

const challengeTemplates = [
  ["belief-awareness-21", "21-Day Belief Awareness", 21, "belief", "BELIEF", "Notice the belief underneath daily choices."],
  ["morning-consistency-21", "21-Day Morning Consistency", 21, "morning", "BEHAVIOUR", "Build a reliable morning practice without perfectionism."],
  ["intentional-action-21", "21-Day Intentional Action", 21, "discipline", "BEHAVIOUR", "Turn reflection into one visible action each day."],
  ["gratitude-practice-21", "21-Day Gratitude Practice", 21, "gratitude", "BELIEF", "Train attention toward specific appreciation."],
  ["energy-awareness-21", "21-Day Energy Awareness", 21, "energy", "PATTERN", "Notice and protect the sources of your energy."],
  ["digital-clarity-21", "21-Day Digital Clarity", 21, "focus", "BEHAVIOUR", "Reduce scattered attention through daily boundaries."],
  ["wealth-receiving-21", "21-Day Receiving Practice", 21, "wealth", "BELIEF", "Practice value, receiving, and grounded responsibility."],
  ["identity-rewire-66", "66-Day Identity Rewire", 66, "identity", "PATTERN", "Repeat aligned actions until they feel believable."],
  ["focus-reset-66", "66-Day Focus Reset", 66, "focus", "PATTERN", "Rebuild attention through simple daily completion."],
  ["leadership-presence-66", "66-Day Leadership Presence", 66, "leadership", "PATTERN", "Practice calm, clear leadership in ordinary moments."],
  ["quarter-mastery-90", "90-Day ARISE Mastery", 90, "mastery", "RESULT", "Integrate belief, behaviour, pattern, and result across a full quarter."],
  ["purposeful-results-90", "90-Day Purposeful Results", 90, "purpose", "RESULT", "Connect meaningful action to visible outcomes."],
];

const dailyPromptSeeds = [
  "Name the belief most active today and choose one supporting action.",
  "Complete one small action before checking for outside approval.",
  "Notice a repeated pattern and interrupt it with one conscious pause.",
  "Write one piece of evidence that your identity is changing.",
  "Practice receiving support, appreciation, or feedback without deflecting.",
  "Protect one block of attention from avoidable interruption.",
  "Close one open loop that has been draining energy.",
  "Choose a response that your future self would recognize.",
  "Record one result without turning it into a judgment.",
  "Return to the practice after a drift without self-criticism.",
];

export const challenges = challengeTemplates.map(([slug, title, lengthDays, category, layer, description], index) => ({
  ...base(slug, index + 1, { featured: index < 4 }),
  title,
  teacher: "ARISE",
  lengthDays,
  description,
  category,
  layer,
  difficulty: lengthDays === 21 ? "beginner" : "intermediate",
  dailyTasks: Array.from({ length: lengthDays }, (_, dayIndex) => ({
    day: dayIndex + 1,
    prompt: `Day ${dayIndex + 1}: ${dailyPromptSeeds[(dayIndex + index) % dailyPromptSeeds.length]}`,
  })),
}));

export const seedCollections = {
  masters,
  asanas,
  breathwork,
  affirmations,
  quotes,
  challenges,
};
