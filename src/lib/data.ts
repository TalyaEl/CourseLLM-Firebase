import type { Course, Topic, ChatMessage, QuizQuestion } from './types';

export const COURSES: Course[] = [
  {
    id: 'cs101',
    name: 'CS 101: Data Structures',
    description: 'An introductory course to fundamental data structures and algorithms.',
    image: 'course_data_structures',
  },
  {
    id: 'cs202',
    name: 'CS 202: Operating Systems',
    description: 'Learn the core concepts of modern operating systems.',
    image: 'course_operating_systems',
  },
];

export const TOPICS: Topic[] = [
  { id: 'arrays', name: 'Arrays', mastery: 'strong' },
  { id: 'linked-lists', name: 'Linked Lists', mastery: 'strong' },
  { id: 'recursion', name: 'Recursion', mastery: 'needs_practice' },
  { id: 'trees', name: 'Trees', mastery: 'needs_practice' },
  { id: 'graphs', name: 'Graphs', mastery: 'weak' },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
    {
        id: 1,
        role: 'assistant',
        content: "Welcome to CS 101! I am your Socratic Tutor. How can I help you explore the world of data structures today?"
    }
];

export const SOCRATIC_RESPONSE: ChatMessage = {
    id: 0, // will be replaced
    role: 'assistant',
    content: "That's an excellent question. Instead of telling you the answer directly, let's explore it together. What do you think is the main difference between an array and a linked list in terms of memory allocation?",
    citations: [
        "Chapter 3: Memory Management, Course Textbook",
        "Lecture 4 Slides: Arrays vs. Linked Lists"
    ]
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is the time complexity for accessing an element in an array by its index?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
    correctAnswer: 'O(1)',
  },
  {
    id: 'q2',
    question: 'Which of these is not a linear data structure?',
    options: ['Array', 'Stack', 'Queue', 'Tree'],
    correctAnswer: 'Tree',
  },
  {
    id: 'q3',
    question: 'In a singly linked list, which operation is the most time-consuming?',
    options: ['Inserting at the beginning', 'Deleting from the beginning', 'Accessing the last element', 'Accessing the first element'],
    correctAnswer: 'Accessing the last element',
  },
];

export const ANALYTICS_DATA = [
  { topic: 'Arrays', mastery: 92 },
  { topic: 'Linked Lists', mastery: 85 },
  { topic: 'Recursion', mastery: 65 },
  { topic: 'Trees', mastery: 58 },
  { topic: 'Graphs', mastery: 45 },
];
