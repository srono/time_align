import { Poll, Participant } from '../types';
import { getAccessToken } from './calendarService';

const GCS_BASE_URL = 'https://storage.googleapis.com/storage/v1/b';
const GCS_UPLOAD_URL = 'https://storage.googleapis.com/upload/storage/v1/b';

interface GcsObject {
  generation: string;
  // other fields omitted
}

/**
 * Fetches a poll from the specified Google Cloud Storage bucket.
 */
export const fetchPoll = async (id: string, bucketName: string): Promise<{ poll: Poll, generation: string } | null> => {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated. Please connect Google account.");

  try {
    const response = await fetch(`${GCS_BASE_URL}/${bucketName}/o/${id}.json?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to fetch poll from cloud");

    // We also need the generation ID for optimistic locking, so we fetch metadata separately or rely on headers if available.
    // However, ?alt=media returns the content. We can get generation from the metadata endpoint.
    // For simplicity in this demo, we'll fetch metadata first to get generation.
    
    const metaResponse = await fetch(`${GCS_BASE_URL}/${bucketName}/o/${id}.json`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const meta: GcsObject = await metaResponse.json();

    const poll: Poll = await response.json();
    return { poll, generation: meta.generation };

  } catch (e) {
    console.error("Storage Fetch Error:", e);
    return null;
  }
};

/**
 * Saves a poll to the bucket.
 * Uses simple upload (overwrites).
 */
export const savePoll = async (poll: Poll, bucketName: string): Promise<void> => {
    const token = getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const blob = new Blob([JSON.stringify(poll)], { type: 'application/json' });
    
    // We use the upload endpoint. `POST` to /o creates or updates if name is specified?
    // Actually `PUT` to the resource is cleaner for updates, but `POST` with uploadType=media&name=... works for creation.
    // To ensure we update, we effectively overwrite.
    
    const response = await fetch(`${GCS_UPLOAD_URL}/${bucketName}/o?uploadType=media&name=${poll.id}.json`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: blob
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to save to cloud: ${err}`);
    }
};

/**
 * Adds a vote to a poll with optimistic locking (read-modify-write).
 * Retries up to 3 times on collision.
 */
export const addParticipantVote = async (pollId: string, bucketName: string, participant: Participant): Promise<Poll | null> => {
    const token = getAccessToken();
    if (!token) throw new Error("Not authenticated");

    let attempts = 0;
    while (attempts < 3) {
        attempts++;
        const data = await fetchPoll(pollId, bucketName);
        if (!data) return null;

        const { poll, generation } = data;

        // Update logic
        const existingIndex = poll.participants.findIndex(p => p.name === participant.name);
        if (existingIndex >= 0) {
            poll.participants[existingIndex] = participant;
        } else {
            poll.participants.push(participant);
        }

        const blob = new Blob([JSON.stringify(poll)], { type: 'application/json' });

        // Use PUT with ifGenerationMatch for atomic update
        const response = await fetch(`${GCS_UPLOAD_URL}/${bucketName}/o/${pollId}.json?uploadType=media`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-goog-if-generation-match': generation
            },
            body: blob
        });

        if (response.status === 412) {
            console.warn("Precondition failed (race condition), retrying...");
            continue;
        }

        if (!response.ok) {
            throw new Error("Failed to save vote");
        }

        return poll;
    }
    
    throw new Error("Could not save vote due to high contention. Please try again.");
};