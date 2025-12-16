import { TimeSlot } from '../types';

// Scopes required for the application
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize the gapi client
 */
export const initializeGapiClient = async () => {
  if (gapiInited) return;
  
  await new Promise<void>((resolve, reject) => {
    (window as any).gapi.load('client', { callback: resolve, onerror: reject });
  });
  
  await (window as any).gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });
  
  gapiInited = true;
};

/**
 * Initialize the Google Identity Services client
 */
export const initializeGisClient = (clientId: string) => {
  if (gisInited) return;
  
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // Defined at request time
  });
  
  gisInited = true;
};

/**
 * Trigger the auth flow and return token validity
 */
export const authenticateGoogle = async (clientId: string): Promise<boolean> => {
    // Ensure scripts are loaded
    if (!(window as any).gapi || !(window as any).google) {
        throw new Error("Google APIs not loaded");
    }

    try {
        await initializeGapiClient();
        initializeGisClient(clientId);

        return new Promise((resolve, reject) => {
            tokenClient.callback = async (resp: any) => {
                if (resp.error !== undefined) {
                    reject(resp);
                }
                resolve(true);
            };

            // Request access token
            // Prompt user if no token exists or if we want to force consent
            tokenClient.requestAccessToken({ prompt: '' });
        });
    } catch (err) {
        console.error("Auth Error", err);
        return false;
    }
};

/**
 * Fetch calendar events for a specific date range
 */
export const fetchCalendarEvents = async (timeMin: Date, timeMax: Date): Promise<TimeSlot[]> => {
    if (!gapiInited) throw new Error("GAPI not initialized");

    try {
        const response = await (window as any).gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': timeMin.toISOString(),
            'timeMax': timeMax.toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime',
        });

        const events = response.result.items;
        if (!events || events.length === 0) {
            return [];
        }

        // Map Google Calendar events to our TimeSlot format
        return events.map((event: any) => {
            // Skip all-day events for busy slots (usually holidays or reminders) unless blocking
            // For simplicity, we only take events with specific dateTime
            if (!event.start.dateTime || !event.end.dateTime) return null;

            return {
                id: event.id,
                startTime: event.start.dateTime,
                endTime: event.end.dateTime,
            };
        }).filter(Boolean); // Filter out nulls

    } catch (err) {
        console.error("Error fetching events", err);
        throw err;
    }
};