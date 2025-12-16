import { Poll, Participant, Vote } from '../types';

const STORAGE_KEY = 'time_align_polls';

export const savePoll = (poll: Poll): void => {
  const polls = getPolls();
  polls[poll.id] = poll;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
};

export const getPolls = (): Record<string, Poll> => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const getPollById = (id: string): Poll | null => {
  const polls = getPolls();
  return polls[id] || null;
};

export const addParticipantVote = (pollId: string, participant: Participant): Poll | null => {
  const polls = getPolls();
  const poll = polls[pollId];
  if (!poll) return null;

  // Check if participant already exists (simple update by name for this demo, usually ID)
  const existingIndex = poll.participants.findIndex(p => p.name === participant.name); // Simple name match for anonymous
  
  if (existingIndex >= 0) {
    poll.participants[existingIndex] = participant;
  } else {
    poll.participants.push(participant);
  }

  polls[pollId] = poll;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
  return poll;
};