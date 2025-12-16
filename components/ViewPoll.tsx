import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPollById, addParticipantVote } from '../services/storageService';
import { analyzeBestSlot } from '../services/geminiService';
import { Poll, VoteType, Participant, Vote } from '../types';
import Button from './Button';

const ViewPoll: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [pendingVotes, setPendingVotes] = useState<Record<string, VoteType>>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (id) {
      const storedPoll = getPollById(id);
      setPoll(storedPoll);
    }
  }, [id]);

  const handleVoteChange = (slotId: string, type: VoteType) => {
    setPendingVotes(prev => {
        const newState = { ...prev };
        if (newState[slotId] === type) {
            delete newState[slotId]; // Deselect
        } else {
            newState[slotId] = type;
        }
        return newState;
    });
  };

  const submitVotes = () => {
    if (!poll || !participantName.trim()) return;

    // Convert pending votes record to array
    const votesList: Vote[] = Object.entries(pendingVotes).map(([slotId, type]) => ({
      slotId,
      type: type as VoteType
    }));

    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: participantName,
      votes: votesList
    };

    const updatedPoll = addParticipantVote(poll.id, newParticipant);
    if (updatedPoll) {
      setPoll(updatedPoll);
      setParticipantName('');
      setPendingVotes({});
      setAiSummary(null); // Reset analysis as data changed
    }
  };

  const handleAnalyze = async () => {
    if (!poll) return;
    setIsAnalyzing(true);
    const summary = await analyzeBestSlot(poll.slots, poll.participants);
    setAiSummary(summary);
    setIsAnalyzing(false);
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // derived state for counts
  const slotCounts = useMemo(() => {
    if (!poll) return {};
    const counts: Record<string, { yes: number, maybe: number, no: number }> = {};
    
    poll.slots.forEach(slot => {
        counts[slot.id] = { yes: 0, maybe: 0, no: 0 };
    });

    poll.participants.forEach(p => {
        p.votes.forEach(v => {
            if (counts[v.slotId]) {
                if (v.type === VoteType.YES) counts[v.slotId].yes++;
                if (v.type === VoteType.MAYBE) counts[v.slotId].maybe++;
                if (v.type === VoteType.NO) counts[v.slotId].no++;
            }
        });
    });
    return counts;
  }, [poll]);

  if (!poll) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">Poll not found</h2>
                <Link to="/" className="text-brand-600 hover:underline mt-4 block">Go Home</Link>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{poll.title}</h1>
          {poll.description && <p className="text-gray-500 mt-1">{poll.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1"><i className="fas fa-user"></i> {poll.creatorName}</span>
            {poll.location && <span className="flex items-center gap-1"><i className="fas fa-map-marker-alt"></i> {poll.location}</span>}
          </div>
        </div>
        <div className="flex gap-2">
             <Link to={`/edit/${poll.id}`}>
                <Button variant="secondary">
                   <i className="fas fa-pen"></i> Edit
                </Button>
             </Link>
             <Button variant="outline" onClick={copyLink}>
                <i className={`fas ${isCopied ? 'fa-check' : 'fa-link'}`}></i> {isCopied ? 'Copied' : 'Copy Link'}
             </Button>
             <Button variant="secondary" onClick={handleAnalyze} isLoading={isAnalyzing}>
                <i className="fas fa-magic"></i> Find Best Time
             </Button>
        </div>
      </div>

      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex gap-3 animate-fade-in">
           <div className="bg-indigo-100 p-2 h-fit rounded-full text-indigo-600">
              <i className="fas fa-robot"></i>
           </div>
           <div>
               <h4 className="font-bold text-indigo-900">AI Analysis</h4>
               <p className="text-indigo-800">{aiSummary}</p>
           </div>
        </div>
      )}

      {/* Voting Table */}
      <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4 text-left w-64 min-w-[200px] sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                   <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Participants</span>
                </th>
                {poll.slots.map(slot => (
                  <th key={slot.id} className="p-4 text-center min-w-[120px]">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-brand-600 uppercase">
                         {new Date(slot.startTime).toLocaleDateString(undefined, {month: 'short'})}
                      </span>
                      <span className="text-xl font-bold text-gray-800">
                         {new Date(slot.startTime).getDate()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(slot.startTime).toLocaleDateString(undefined, {weekday: 'short'})}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        {new Date(slot.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Existing Participants */}
              {poll.participants.map(participant => (
                <tr key={participant.id} className="hover:bg-gray-50">
                  <td className="p-4 sticky left-0 bg-white z-10 font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                            {participant.name.charAt(0).toUpperCase()}
                         </div>
                        {participant.name}
                    </div>
                  </td>
                  {poll.slots.map(slot => {
                    const vote = participant.votes.find(v => v.slotId === slot.id);
                    return (
                      <td key={slot.id} className="p-4 text-center">
                        {vote?.type === VoteType.YES && <i className="fas fa-check text-green-500 text-xl"></i>}
                        {vote?.type === VoteType.MAYBE && <i className="fas fa-check text-yellow-500 text-xl opacity-60"></i>}
                        {(!vote || vote.type === VoteType.NO) && <span className="text-gray-200">-</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Vote Input Row */}
              <tr className="bg-blue-50/50">
                <td className="p-4 sticky left-0 bg-blue-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                   <input
                     value={participantName}
                     onChange={(e) => setParticipantName(e.target.value)}
                     placeholder="Enter your name..."
                     className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                   />
                </td>
                {poll.slots.map(slot => {
                    const currentVote = pendingVotes[slot.id];
                    return (
                        <td key={slot.id} className="p-2 text-center align-middle">
                            <div className="flex justify-center gap-1">
                                <button 
                                    onClick={() => handleVoteChange(slot.id, VoteType.YES)}
                                    className={`w-8 h-8 rounded-md transition-all ${currentVote === VoteType.YES ? 'bg-green-500 text-white shadow-md scale-110' : 'bg-white border hover:bg-green-50 text-gray-300'}`}
                                >
                                    <i className="fas fa-check"></i>
                                </button>
                                <button 
                                    onClick={() => handleVoteChange(slot.id, VoteType.MAYBE)}
                                    className={`w-8 h-8 rounded-md transition-all ${currentVote === VoteType.MAYBE ? 'bg-yellow-400 text-white shadow-md scale-110' : 'bg-white border hover:bg-yellow-50 text-gray-300'}`}
                                >
                                    ( )
                                </button>
                            </div>
                        </td>
                    )
                })}
              </tr>
            </tbody>
            <tfoot className="bg-gray-50 border-t">
                <tr>
                    <td className="p-4 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10">Total Yes</td>
                    {poll.slots.map(slot => (
                        <td key={slot.id} className="p-4 text-center font-bold text-gray-800">
                             {slotCounts[slot.id]?.yes || 0}
                        </td>
                    ))}
                </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end sticky bottom-0 z-20">
             <Button 
                onClick={submitVotes}
                disabled={!participantName || Object.keys(pendingVotes).length === 0}
                className="shadow-lg"
             >
                Submit Vote
             </Button>
        </div>
      </div>
    </div>
  );
};

export default ViewPoll;