export interface TimeSlot {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
}

export enum VoteType {
  YES = 'YES',
  MAYBE = 'MAYBE',
  NO = 'NO'
}

export interface Vote {
  slotId: string;
  type: VoteType;
}

export interface Participant {
  id: string;
  name: string;
  votes: Vote[]; // Array of votes for this participant
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  location?: string;
  createdAt: string;
  creatorName: string;
  slots: TimeSlot[];
  participants: Participant[];
}

export interface CreatePollDraft {
  title: string;
  description: string;
  location: string;
  creatorName: string;
  slots: TimeSlot[];
}
