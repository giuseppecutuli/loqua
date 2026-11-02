import type { CefrLevel } from '@loqua/core';

export const CONVERSATION_REGISTERS = ['casual', 'neutral', 'formal'] as const;

export type ConversationRegister = (typeof CONVERSATION_REGISTERS)[number];

export interface ConversationScenario {
  readonly id: string;
  readonly targetLang: string;
  readonly level: CefrLevel;
  readonly title: string;
  readonly setting: string;
  readonly goal: string;
  readonly learnerRole: string;
  readonly tutorRole: string;
  readonly register: ConversationRegister;
  readonly targetPhrases: readonly string[];
  readonly openingLine: string;
  readonly maxTurns: number;
  readonly safetyNotes: readonly string[];
}

export const CONVERSATION_SCENARIOS: readonly ConversationScenario[] = [
  {
    id: 'en.scenario.cafe_order',
    targetLang: 'en',
    level: 'A1',
    title: 'Ordering at a Café',
    setting: 'A busy neighbourhood café in the morning.',
    goal: 'Order a drink and a snack, ask the price, and choose to eat in or take away.',
    learnerRole: 'Customer',
    tutorRole: 'Barista',
    register: 'casual',
    targetPhrases: [
      'Can I have a coffee, please?',
      "I'd like a cheese sandwich.",
      'How much is it?',
      'For here, please.',
      'Thank you. Have a nice day.',
    ],
    openingLine: 'Good morning! What can I get you today?',
    maxTurns: 8,
    safetyNotes: [
      'Keep the order fictional and do not share payment details.',
      'The tutor does not give allergy or medical advice; suggest asking staff about ingredients.',
    ],
  },
  {
    id: 'en.scenario.doctor_visit',
    targetLang: 'en',
    level: 'A2',
    title: "At the Doctor's",
    setting: 'A walk-in clinic on a weekday morning.',
    goal: 'Describe symptoms, answer follow-up questions, and confirm the next steps.',
    learnerRole: 'Patient',
    tutorRole: 'Doctor',
    register: 'neutral',
    targetPhrases: [
      "I've had a sore throat for three days.",
      'I have a headache and I feel very tired.',
      'Do I need to take any medicine?',
      'Should I stay home from work?',
      'Thank you. When should I come back?',
    ],
    openingLine: 'Hello, come in and take a seat. What seems to be the problem?',
    maxTurns: 10,
    safetyNotes: [
      'This is a language roleplay, not medical care.',
      'Do not request diagnoses, dosages, or emergency guidance; urgent symptoms belong with local emergency services.',
    ],
  },
  {
    id: 'en.scenario.airport_checkin',
    targetLang: 'en',
    level: 'A2',
    title: 'Airport Check-in',
    setting: 'An airline check-in desk two hours before a flight.',
    goal: 'Check in a bag, ask about hand luggage, and find the gate and boarding time.',
    learnerRole: 'Passenger',
    tutorRole: 'Check-in agent',
    register: 'neutral',
    targetPhrases: [
      "I'd like to check in for my flight, please.",
      'Can I take this bag as hand luggage?',
      'Which gate does the flight leave from?',
      'What time does boarding start?',
      'My bag is a little heavy. What are my options?',
    ],
    openingLine: 'Good afternoon. May I see your passport and booking reference, please?',
    maxTurns: 10,
    safetyNotes: [
      'Keep travel documents fictional.',
      'Never share real passport numbers, booking references, or payment details in the conversation.',
    ],
  },
  {
    id: 'en.scenario.small_talk_neighbour',
    targetLang: 'en',
    level: 'A1',
    title: 'Small Talk with a Neighbour',
    setting: 'The shared garden of an apartment building on a Saturday.',
    goal: 'Introduce yourself, say where you live, ask simple questions, and end the chat politely.',
    learnerRole: 'New neighbour',
    tutorRole: 'Long-term neighbour',
    register: 'casual',
    targetPhrases: [
      "Hi, I'm new here.",
      'I live in apartment 4B.',
      'Do you like living here?',
      'Nice to meet you.',
      'See you later.',
    ],
    openingLine: 'Hi there! Are you the new neighbour?',
    maxTurns: 8,
    safetyNotes: [
      'Keep topics light and avoid politics, religion, health, money, and personal data.',
      'The learner can decline any question and change the subject.',
    ],
  },
  {
    id: 'en.scenario.work_standup',
    targetLang: 'en',
    level: 'B1',
    title: 'Daily Team Standup',
    setting: 'A short morning video call with a small product team.',
    goal: 'Give a brief update on recent work, current work, and blockers, and ask for help.',
    learnerRole: 'Team member',
    tutorRole: 'Team lead',
    register: 'neutral',
    targetPhrases: [
      'Yesterday I finished the onboarding screens.',
      "Today I'm working on the empty state.",
      "I'm blocked on the API response.",
      'Could someone help me with the test data?',
      'I should have an update by tomorrow.',
    ],
    openingLine: "Morning, everyone. Let's keep this short. Who wants to start?",
    maxTurns: 10,
    safetyNotes: [
      'Use fictional projects and team names only.',
      'Do not request confidential company information, credentials, or personal details.',
    ],
  },
  {
    id: 'en.scenario.code_review',
    targetLang: 'en',
    level: 'B2',
    title: 'Reviewing a Pull Request',
    setting: 'A written code review thread on a small engineering team.',
    goal: 'Explain a design choice, ask for clarification, and agree on a change politely.',
    learnerRole: 'Pull request author',
    tutorRole: 'Senior reviewer',
    register: 'neutral',
    targetPhrases: [
      'Thanks for the detailed review.',
      'I chose batching here to reduce database calls.',
      'Could you clarify what you mean by the edge case?',
      "That's a fair point; I'll add a test for it.",
      "I'd rather keep the cache simple for now.",
    ],
    openingLine:
      'I left a few comments on the caching logic. Could you walk me through why you picked that approach?',
    maxTurns: 10,
    safetyNotes: [
      'Use fictional code only and never include secrets, tokens, or credentials.',
      'The tutor gives language feedback, not security or production approval.',
    ],
  },
  {
    id: 'en.scenario.job_interview',
    targetLang: 'en',
    level: 'C1',
    title: 'Final-Round Job Interview',
    setting: 'A video interview for a senior role at a mid-sized company.',
    goal: 'Discuss experience with nuance, answer a behavioural question, and ask thoughtful questions.',
    learnerRole: 'Candidate',
    tutorRole: 'Hiring manager',
    register: 'formal',
    targetPhrases: [
      "I'd say my strongest contribution was the redesign of the onboarding flow.",
      'Looking back, I would have involved support earlier.',
      "That's a fair question; let me give you some context.",
      'Could you tell me more about how the team measures success?',
      'What does success look like in the first six months?',
    ],
    openingLine:
      "Thanks for making the time today. To start, could you walk me through the decision you're most proud of in the last few years?",
    maxTurns: 12,
    safetyNotes: [
      'Avoid protected characteristics and personal questions about age, family, health, nationality, or religion.',
      'Keep the company, role, and examples fictional.',
    ],
  },
  {
    id: 'en.scenario.service_complaint',
    targetLang: 'en',
    level: 'C1',
    title: 'Escalating a Service Complaint',
    setting: 'A phone call with a customer support supervisor after a delayed delivery.',
    goal: 'State the issue clearly, explain the impact, request a concrete resolution, and stay firm but polite.',
    learnerRole: 'Customer',
    tutorRole: 'Support supervisor',
    register: 'formal',
    targetPhrases: [
      "I'm calling because the delivery is now ten days late.",
      "I appreciate that, but I've already been promised a callback twice.",
      "What I'm asking for is a full refund and an explanation.",
      "I'd like this confirmed in writing, please.",
      "If that's not possible, could you escalate it?",
    ],
    openingLine:
      "Thank you for holding. I understand you'd like to discuss an order. Could you start by explaining what happened?",
    maxTurns: 12,
    safetyNotes: [
      'Stay factual and polite; no threats, harassment, or abusive language.',
      'Do not share real order numbers, addresses, or payment details.',
    ],
  },
  {
    id: 'en.scenario.phone_booking',
    targetLang: 'en',
    level: 'B1',
    title: 'Booking a Table by Phone',
    setting: 'A phone call to book a table at a small restaurant.',
    goal: 'Book a table for four, change the time, and confirm the details.',
    learnerRole: 'Caller',
    tutorRole: 'Restaurant host',
    register: 'neutral',
    targetPhrases: [
      "I'd like to book a table for four, please.",
      'Would seven thirty work?',
      "Could I change it to eight o'clock?",
      'Sorry, could you repeat that?',
      'Thanks, see you on Friday.',
    ],
    openingLine: 'Good evening, thanks for calling. How can I help you?',
    maxTurns: 8,
    safetyNotes: [
      'Use a fictional venue and booking.',
      'Do not share real phone numbers, addresses, or payment details.',
    ],
  },
  {
    id: 'en.scenario.travel_disruption',
    targetLang: 'en',
    level: 'B2',
    title: 'A Missed Connection',
    setting:
      'A train station service desk after a delayed train made the learner miss a connection.',
    goal: 'Explain what happened, ask about later trains, and request a refund or overnight help.',
    learnerRole: 'Passenger',
    tutorRole: 'Station assistant',
    register: 'neutral',
    targetPhrases: [
      'My train was delayed, so I missed the connection.',
      'Are there any later trains this evening?',
      'Could you stamp my ticket so I can claim a refund?',
      'Is there a hotel nearby if I have to stay overnight?',
      'Could you write down the alternative route for me?',
    ],
    openingLine: 'Good evening. The next counter is free. How can I help?',
    maxTurns: 10,
    safetyNotes: [
      'Use fictional journey details.',
      'Do not share real passport, booking, or payment information; follow only official staff instructions.',
    ],
  },
];

const SCENARIOS_BY_ID = new Map(CONVERSATION_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getConversationScenario(id: string): ConversationScenario | undefined {
  return SCENARIOS_BY_ID.get(id);
}
