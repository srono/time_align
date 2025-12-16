import React from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';

const Hero: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="mb-6 relative">
         <div className="absolute -inset-4 bg-brand-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
         <div className="bg-white p-4 rounded-2xl shadow-xl relative transform -rotate-3">
            <i className="fas fa-calendar-check text-6xl text-brand-600"></i>
         </div>
      </div>
      <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
        Scheduling made <span className="text-brand-600">Genius</span>
      </h1>
      <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
        The easiest way to find a time for everyone. 
        Connect your calendar, let AI suggest the best slots, and vote anonymously.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
        <Link to="/create" className="w-full">
            <Button className="w-full text-lg py-4 shadow-xl shadow-brand-500/20">
                Create a Poll
            </Button>
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4 mx-auto">
                <i className="fas fa-magic"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">AI Suggestions</h3>
            <p className="text-gray-500 text-sm">Type natural language like "next week afternoons" and let Gemini AI build your slots.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4 mx-auto">
                <i className="fab fa-google"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Calendar Sync</h3>
            <p className="text-gray-500 text-sm">Simulate connecting your Google Calendar to avoid double booking effortlessly.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4 mx-auto">
                <i className="fas fa-user-secret"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Anonymous Voting</h3>
            <p className="text-gray-500 text-sm">Participants can vote with just a name. No accounts or sign-ups required.</p>
        </div>
      </div>
    </div>
  );
};

export default Hero;