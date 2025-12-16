import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useParams } from 'react-router-dom';
import { CreatePollDraft, TimeSlot } from '../types';
import { generateSlotsFromNaturalLanguage } from '../services/geminiService';
import { savePoll, fetchPoll } from '../services/storageService';
import { authenticateGoogle, fetchCalendarEvents, getAccessToken } from '../services/calendarService';
import Button from './Button';

const CreatePoll: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Storage Config
  const [bucketName, setBucketName] = useState(() => localStorage.getItem('gcs_bucket_name') || '');
  const [clientId, setClientId] = useState(() => localStorage.getItem('google_client_id') || '');
  
  const [draft, setDraft] = useState<CreatePollDraft>({
    title: '',
    description: '',
    location: '',
    creatorName: '',
    slots: []
  });
  
  const [duration, setDuration] = useState<number>(60);
  const [weekStart, setWeekStart] = useState<Date>(new Date());

  // Load existing poll if editing
  useEffect(() => {
    const loadPoll = async () => {
        if (id && bucketName && getAccessToken()) {
            setLoading(true);
            const data = await fetchPoll(id, bucketName);
            if (data) {
                const { poll } = data;
                setDraft({
                    title: poll.title,
                    description: poll.description,
                    location: poll.location || '',
                    creatorName: poll.creatorName,
                    slots: poll.slots
                });
                
                if (poll.slots.length > 0) {
                     const earliest = poll.slots.reduce((min, s) => s.startTime < min ? s.startTime : min, poll.slots[0].startTime);
                     const d = new Date(earliest);
                     d.setHours(0,0,0,0);
                     const day = d.getDay();
                     const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                     setWeekStart(new Date(d.setDate(diff)));
                }
            }
            setLoading(false);
        }
    };
    loadPoll();
  }, [id, bucketName]); // Trigger when bucket is set/auth is ready

  // AI & Calendar State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [busySlots, setBusySlots] = useState<TimeSlot[]>([]);
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const contextDate = weekStart.toISOString().split('T')[0];
      const suggestedSlots = await generateSlotsFromNaturalLanguage(aiPrompt, contextDate, duration);
      
      const newSlots: TimeSlot[] = suggestedSlots.map(s => ({
        id: uuidv4(),
        startTime: s.startTime,
        endTime: s.endTime
      }));
      setDraft(prev => ({ ...prev, slots: [...prev.slots, ...newSlots] }));
      setAiPrompt('');
    } catch (err) {
      alert("Failed to generate slots. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRealConnect = async () => {
      if (!clientId || !bucketName) {
          alert("Please enter both Client ID and Bucket Name");
          return;
      }
      localStorage.setItem('google_client_id', clientId);
      localStorage.setItem('gcs_bucket_name', bucketName);
      
      setIsConnecting(true);
      try {
          await authenticateGoogle(clientId);
          
          // Fetch for current view + 2 weeks buffer
          const start = new Date(weekStart);
          const end = new Date(weekStart);
          end.setDate(end.getDate() + 21); // 3 weeks

          const events = await fetchCalendarEvents(start, end);
          setBusySlots(events);
          setIsCalendarConnected(true);
          setShowCalendarConfig(false);
          
          // If editing, re-trigger load now that we have auth
          if (isEditing && id) {
              // The useEffect will catch the token change if we were tracking it, 
              // but we might need to manually trigger if it doesn't.
              // For now, reloading page or effect dependency handles it.
          }

      } catch (error) {
          console.error(error);
          alert("Failed to connect. Ensure your Client ID is correct and your Bucket supports CORS.");
      } finally {
          setIsConnecting(false);
      }
  };

  const handleFinish = async () => {
    if (draft.slots.length === 0) {
      alert("Please add at least one time slot.");
      return;
    }

    if (!getAccessToken()) {
        setShowCalendarConfig(true);
        alert("You must connect your Google Account to save to Cloud Storage.");
        return;
    }

    setLoading(true);
    try {
        let pollId = id;
        let createdAt = new Date().toISOString();
        let participants = [];

        if (isEditing && id) {
             const data = await fetchPoll(id, bucketName);
             if (data) {
                createdAt = data.poll.createdAt;
                participants = data.poll.participants;
             }
        } else {
            pollId = uuidv4();
        }

        if (!pollId) return; // Should not happen

        const finalPoll = {
            ...draft,
            id: pollId,
            createdAt,
            participants
        };

        await savePoll(finalPoll, bucketName);
        // Include bucket in the URL so voters know where to look
        navigate(`/poll/${pollId}?bucket=${bucketName}`);
    } catch (err) {
        console.error(err);
        alert("Failed to save poll. Check console for details.");
    } finally {
        setLoading(false);
    }
  };

  const removeSlot = (id: string) => {
    setDraft(prev => ({ ...prev, slots: prev.slots.filter(s => s.id !== id) }));
  };

  const toggleSlot = (startTime: Date) => {
    const startIso = startTime.toISOString();
    const existing = draft.slots.find(s => {
        const sTime = new Date(s.startTime);
        return Math.abs(sTime.getTime() - startTime.getTime()) < 60000;
    });

    if (existing) {
        removeSlot(existing.id);
    } else {
        const endTime = new Date(startTime.getTime() + duration * 60000);
        const newSlot = {
            id: uuidv4(),
            startTime: startIso,
            endTime: endTime.toISOString()
        };
        setDraft(prev => ({ ...prev, slots: [...prev.slots, newSlot] }));
    }
  };

  const moveWeek = (direction: 'prev' | 'next') => {
      const newDate = new Date(weekStart);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      setWeekStart(newDate);
  };

  // Calendar Helpers
  const START_HOUR = 8;
  const END_HOUR = 20; 
  const HOURS_COUNT = END_HOUR - START_HOUR;
  const ROW_HEIGHT = 60; 

  const weekDates = useMemo(() => {
    const dates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
  }, [weekStart]);

  const getSlotStyle = (slot: TimeSlot, dayDate: Date) => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    // Create boundary dates for the current column's day
    const viewStart = new Date(dayDate);
    viewStart.setHours(START_HOUR, 0, 0, 0);

    const viewEnd = new Date(dayDate);
    viewEnd.setHours(END_HOUR, 0, 0, 0);

    // If slot is completely outside of the viewable hours for this day
    if (end <= viewStart || start >= viewEnd) {
      return { display: 'none' };
    }

    // Clamp start/end to the view boundaries
    const effectiveStart = start < viewStart ? viewStart : start;
    const effectiveEnd = end > viewEnd ? viewEnd : end;

    // Calculate vertical position
    const startDiffMs = effectiveStart.getTime() - viewStart.getTime();
    const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();

    // 1 hour = 60 minutes * 60 seconds * 1000 ms = 3600000 ms
    // ROW_HEIGHT pixels per hour
    const pixelsPerMs = ROW_HEIGHT / 3600000;

    const top = startDiffMs * pixelsPerMs;
    const height = Math.max(durationMs * pixelsPerMs, 1); // Ensure at least 1px height

    return {
        top: `${top}px`,
        height: `${height}px`,
        left: '2px',
        right: '2px',
    };
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
          <input
            name="title"
            value={draft.title}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="e.g. Q4 Planning Meeting"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>All day (8 hours)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
          <textarea
            name="description"
            value={draft.description}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="What's this meeting about?"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
          <input
            name="location"
            value={draft.location}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="Google Meet, Office, etc."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
          <input
            name="creatorName"
            value={draft.creatorName}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="So people know who's asking"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button 
          disabled={!draft.title || !draft.creatorName}
          onClick={() => setStep(2)}
        >
          {isEditing ? 'Next: Edit Times ' : 'Next: Add Times '} <i className="fas fa-arrow-right"></i>
        </Button>
      </div>
    </div>
  );

  const renderCalendarStep = () => (
    <div className="space-y-6 animate-fade-in relative">
       {/* Top Controls */}
       <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => moveWeek('prev')} className="!px-3"><i className="fas fa-chevron-left"></i></Button>
                <span className="font-semibold text-lg w-48 text-center">
                    {weekStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {new Date(weekStart.getTime() + 6*86400000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                </span>
                <Button variant="secondary" onClick={() => moveWeek('next')} className="!px-3"><i className="fas fa-chevron-right"></i></Button>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                 {!isCalendarConnected ? (
                    <Button variant="outline" onClick={() => setShowCalendarConfig(true)} className="text-sm whitespace-nowrap">
                        <i className="fab fa-google"></i> Connect Calendar / Storage
                    </Button>
                 ) : (
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 px-3 py-2 bg-gray-50 rounded-lg border">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Connected
                        <span className="w-3 h-3 bg-gray-300 rounded-sm ml-2"></span> Busy
                        <span className="w-3 h-3 bg-brand-500 rounded-sm ml-2"></span> Selected
                    </div>
                 )}
            </div>
       </div>

       {/* AI Input */}
       <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border">
          <i className="fas fa-sparkles text-brand-600 ml-2"></i>
          <input 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiSuggest()}
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm"
            placeholder="Ask AI: 'Every Tuesday morning', 'Between 1pm and 4pm tomorrow'..."
          />
          <Button onClick={handleAiSuggest} isLoading={isAiLoading} disabled={!aiPrompt} className="!py-1 !px-3 text-sm">
            Add
          </Button>
       </div>

       {/* Calendar Grid */}
       <div className="border rounded-lg bg-white overflow-hidden shadow-sm flex flex-col h-[600px]">
           {/* Header */}
           <div className="flex border-b divide-x bg-gray-50">
                <div className="w-16 flex-shrink-0 p-2 text-center text-xs font-medium text-gray-500">Time</div>
                {weekDates.map(date => (
                    <div key={date.toISOString()} className={`flex-1 p-2 text-center border-b-2 ${date.toDateString() === new Date().toDateString() ? 'border-brand-500 bg-brand-50' : 'border-transparent'}`}>
                        <div className="text-xs text-gray-500 uppercase">{date.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                        <div className={`font-bold ${date.toDateString() === new Date().toDateString() ? 'text-brand-700' : 'text-gray-800'}`}>
                            {date.getDate()}
                        </div>
                    </div>
                ))}
           </div>
           
           {/* Scrollable Body */}
           <div className="flex-1 overflow-y-auto relative">
                <div className="flex">
                    {/* Time Labels */}
                    <div className="w-16 flex-shrink-0 border-r bg-white z-10 sticky left-0">
                        {Array.from({length: HOURS_COUNT}).map((_, i) => (
                            <div key={i} className="h-[60px] text-xs text-gray-400 text-right pr-2 pt-1 relative">
                                <span className="-top-2 relative">{START_HOUR + i}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Days Columns */}
                    <div className="flex-1 flex divide-x relative" style={{ height: `${HOURS_COUNT * ROW_HEIGHT}px` }}>
                         {/* Background Grid Lines */}
                         <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
                            {Array.from({length: HOURS_COUNT * 2}).map((_, i) => (
                                <div key={i} className={`w-full border-b ${i % 2 === 0 ? 'border-gray-100' : 'border-gray-50 dashed'}`} style={{height: '30px'}}></div>
                            ))}
                         </div>

                         {weekDates.map(dayDate => (
                             <div key={dayDate.toISOString()} className="flex-1 relative group">
                                 {/* Click Area for creating slots (30 min increments) */}
                                 {Array.from({length: HOURS_COUNT * 2}).map((_, i) => {
                                     const slotTime = new Date(dayDate);
                                     slotTime.setHours(START_HOUR + Math.floor(i/2), (i%2) * 30, 0, 0);
                                     
                                     return (
                                        <div 
                                            key={i}
                                            className="h-[30px] w-full hover:bg-brand-50 cursor-pointer transition-colors"
                                            onClick={() => toggleSlot(slotTime)}
                                            title={`Click to add ${duration}m slot at ${slotTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                                        ></div>
                                     );
                                 })}

                                 {/* Render Busy Slots */}
                                 {busySlots
                                    .filter(slot => {
                                       const s = new Date(slot.startTime);
                                       const e = new Date(slot.endTime);
                                       const viewStart = new Date(dayDate);
                                       viewStart.setHours(START_HOUR, 0, 0, 0);
                                       const viewEnd = new Date(dayDate);
                                       viewEnd.setHours(END_HOUR, 0, 0, 0);
                                       return s < viewEnd && e > viewStart;
                                    })
                                    .map(slot => (
                                        <div 
                                            key={slot.id} 
                                            className="absolute bg-gray-200 border-l-4 border-gray-300 opacity-80 rounded-sm z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                                            style={getSlotStyle(slot, dayDate)}
                                        >
                                            <span className="text-[10px] text-gray-500 font-bold -rotate-90 md:rotate-0">BUSY</span>
                                        </div>
                                    ))
                                 }

                                 {/* Render Selected Slots */}
                                 {draft.slots
                                    .filter(slot => {
                                       const s = new Date(slot.startTime);
                                       const e = new Date(slot.endTime);
                                       const viewStart = new Date(dayDate);
                                       viewStart.setHours(START_HOUR, 0, 0, 0);
                                       const viewEnd = new Date(dayDate);
                                       viewEnd.setHours(END_HOUR, 0, 0, 0);
                                       return s < viewEnd && e > viewStart;
                                    })
                                    .map(slot => (
                                        <div 
                                            key={slot.id} 
                                            className="absolute bg-brand-500 hover:bg-brand-600 text-white rounded-md shadow-md z-20 cursor-pointer text-xs p-1 overflow-hidden transition-all border border-brand-600"
                                            style={getSlotStyle(slot, dayDate)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeSlot(slot.id);
                                            }}
                                        >
                                            <div className="font-bold leading-tight">
                                                {new Date(slot.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    ))
                                 }
                             </div>
                         ))}
                    </div>
                </div>
           </div>
       </div>
       
       <div className="flex justify-between pt-4 border-t">
            <div className="text-sm text-gray-500 self-center">
                {draft.slots.length} time slots selected
            </div>
            <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button 
                    onClick={handleFinish}
                    disabled={draft.slots.length === 0}
                    isLoading={loading}
                >
                    {isEditing ? 'Save Changes ' : 'Create Poll '} <i className="fas fa-check"></i>
                </Button>
            </div>
      </div>

      {/* Calendar Config Modal */}
      {showCalendarConfig && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg">
             <div className="bg-white p-6 rounded-xl shadow-2xl border max-w-md w-full animate-fade-in-up">
                 <h3 className="text-lg font-bold text-gray-900 mb-2">Connect Google & Storage</h3>
                 <p className="text-sm text-gray-600 mb-4">
                     Enable Google Calendar and Cloud Storage to save your poll.
                 </p>
                 <div className="mb-4 space-y-3">
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Client ID</label>
                        <input 
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="71239...apps.googleusercontent.com"
                            className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GCS Bucket Name</label>
                        <input 
                            value={bucketName}
                            onChange={(e) => setBucketName(e.target.value)}
                            placeholder="my-poll-app-storage"
                            className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Bucket must be CORS enabled.
                        </p>
                     </div>
                 </div>
                 <div className="flex justify-end gap-2">
                     <Button variant="secondary" onClick={() => setShowCalendarConfig(false)}>Cancel</Button>
                     <Button onClick={handleRealConnect} isLoading={isConnecting} disabled={!clientId || !bucketName}>
                        Connect & Authorize
                     </Button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{isEditing ? 'Edit Poll' : 'Create a New Poll'}</h1>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-brand-600 text-white' : 'bg-gray-200'}`}>1. Details</span>
          <span className="text-gray-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-brand-600 text-white' : 'bg-gray-200'}`}>2. Select Times</span>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl p-6">
        {step === 1 ? renderStep1() : renderCalendarStep()}
      </div>
    </div>
  );
};

export default CreatePoll;