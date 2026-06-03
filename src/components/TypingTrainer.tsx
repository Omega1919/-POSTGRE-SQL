import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, Play, RotateCcw, Award, CheckCircle, Flame, BarChart3, 
  Settings, Type, Volume2, VolumeX, ShieldAlert, BookOpen, Star, 
  Sparkles, History, ArrowRight, TrendingUp, Calendar, Zap
} from 'lucide-react';
import { db } from '../lib/api';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid 
} from 'recharts';

// Majestic, immersive and fun storytelling presets divided by difficulty
const EPIC_STORIES = {
  easy: [
    {
      title: "The Whimsical Adventure of Pip the Pixie",
      paragraphs: [
        "In a tiny green valley, a young pixie named Pip discovered that her wings had lost their lovely silver sparkle.",
        "She ran to the wise old owl who lived in the hollow oak tree, hoping for a magical cure to her dull wings.",
        "The owl blinked slow and said, you must find the legendary golden daisy that grows on the edge of the happy stream.",
        "Pip skipped past the friendly frogs and the singing bluebirds, feeling hopeful that she would find the magical flower.",
        "At last, she saw the glowing yellow petals shining bright like a little sun under the warm summer sky.",
        "She gently touched the pollen, and suddenly, a wave of beautiful sparkling glitter covered her wings once more.",
        "Pip flew high into the sky, laughing with absolute joy, ready to spread happiness across the whole valley forever."
      ]
    },
    {
      title: "Barnaby's Secret Dragon Bakery",
      paragraphs: [
        "Barnaby was not like other dragons; he did not like to scare villagers or burn down old wooden castles.",
        "Instead, Barnaby loved to bake soft chocolate cakes, sweet warm buns, and delicious apple pies for everyone.",
        "His secret weapon was his fire-breath, which could heat up his stone oven to the perfect baking temperature in seconds.",
        "Every Tuesday morning, the delicious smell of fresh cinnamon rolls would drift down the hill into the small village.",
        "The children would run up to his cave with big empty baskets, singing happy songs about Barnaby's famous sugar cookies.",
        "Even the stern mayor of the town declared Barnaby the master pastry chef of the realm, wearing a giant white chef hat."
      ]
    }
  ],
  medium: [
    {
      title: "The Code-Slinging Wizard of Silicon Valley",
      paragraphs: [
        "Alistair was a medieval wizard who accidentally fell into a glowing interdimensional portal during a chaotic spell mishap.",
        "He materialized inside a loud tech office in San Francisco, wearing a dark blue starry robe and holding a glowing staff.",
        "Instead of fighting monsters, he was completely fascinated by high-resolution computer monitors and decided to learn JavaScript coding.",
        "Alistair tried to use magical runes for his Git pushes, which occasionally caused the server racks to levitate in mid-air.",
        "His teammates were utterly shocked when his code comments began speaking in formal Latin, complaining about severe memory leaks.",
        "Eventually, he replaced his wand with a mechanical keyboard, casting powerful algorithms that solved bugs faster than light speed."
      ]
    },
    {
      title: "The Cybernetic Cat of Neo-Tokyo",
      paragraphs: [
        "In the neon-drenched streets of Neo-Tokyo, a stray cat named Pixel received automated bionic upgrades from a rogue cyber-engineer.",
        "With glowing cybernetic eyes and ultra-fast neon paws, Pixel could interface directly with the global web mainframe via mere touch.",
        "While regular cats chased laser pointers, Pixel chased dangerous hacker groups attempting to compromise the city's power grid.",
        "Her midnight missions involved dodging security drones and tapping rapid code onto copper cables hanging high above the streets.",
        "By morning, she would curl up on a solar blanket, purring softly while dreaming of firewalls and delicious electronic mice."
      ]
    }
  ],
  hard: [
    {
      title: "The Galactic Typist and the Quantum Core Melt",
      paragraphs: [
        "Commander Vance realized that the starship's primary propulsion matrix was experiencing an unprecedented thermonuclear cascade collapse.",
        "The automated override terminal was heavily corrupted, forcing him to manually recalibrate the magnetic containment fields under duress.",
        "To prevent the quantum engine from disintegrating, Vance had to type intricate multi-threaded hexadecimal override keys within sixty seconds.",
        "His mechanical input keys clicked like machine-gun fire, navigating complex recursive directories and executing high-level microservice API bypasses.",
        "Sweat gripped onto his palms as the terminal flashed red warnings, but his muscle memory held firm through the entire script.",
        "With a final definitive stroke of the return key, the quantum fluctuation stabilized, restoring peace across the sector's cosmic coordinates."
      ]
    },
    {
      title: "Secrets of the Subterranean Silicon City",
      paragraphs: [
        "Archaeologists exploring the tectonic crevices beneath Antarctica discovered an fully functional subterranean city manufactured by ancient machines.",
        "The metropolis was powered by a geothermal supercomputer, utilizing multi-layered quantum cryptography to protect its central memory banks.",
        "Dr. Evelyn Croft approached the glowing crystal pedestal, recognizing the alphanumeric interface as an advanced variant of standard assembly language.",
        "To unlock the archive of lost human history, she had to execute precise logical parameters, manipulating binary pointers and shifting registers.",
        "One single typographical error would trigger a complete data erase protocol, permanently isolating the lost civilization's knowledge forever.",
        "Her fingers danced with calculated precision, solving the ancient digital labyrinth and initializing the grand holographic display."
      ]
    }
  ]
};

// Backwards-compatible single presets flattened from stories
const TEXT_PRESETS = {
  easy: EPIC_STORIES.easy.flatMap(s => s.paragraphs),
  medium: EPIC_STORIES.medium.flatMap(s => s.paragraphs),
  hard: EPIC_STORIES.hard.flatMap(s => s.paragraphs)
};

interface TypingSession {
  id: number;
  wpm: number;
  accuracy: number;
  difficulty: string;
  duration_seconds: number;
  completed_at: string;
}

interface TypingTrainerProps {
  onBackToExplorer?: () => void;
}

export default function TypingTrainer({ onBackToExplorer }: TypingTrainerProps) {
  // Game Settings and Setup Options
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [pacingMode, setPacingMode] = useState<'30s' | '60s' | 'free'>('30s');
  const [textOption, setTextOption] = useState<'standard' | 'long' | 'endless'>('endless');
  const [fontStyle, setFontStyle] = useState<'sans' | 'mono' | 'serif'>('mono');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game Play Lifecycle State
  const [gameState, setGameState] = useState<'select' | 'playing' | 'completed'>('select');
  const [targetText, setTargetText] = useState('');
  const [typedInput, setTypedInput] = useState('');
  
  // Scoring parameters
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errorCount, setErrorCount] = useState(0);
  const [bestWpm, setBestWpm] = useState(0);

  // Database stats history
  const [history, setHistory] = useState<TypingSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [currentTab, setCurrentTab] = useState<'trainer' | 'dashboard'>('trainer');

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Accumulator tracking for multi-block endless typing mode
  const cumulativeCorrectRef = useRef<number>(0);
  const cumulativeTotalRef = useRef<number>(0);
  const liveWpmRef = useRef<number>(0);
  const liveAccRef = useRef<number>(100);

  // Active immersive story tracking elements
  const [activeStory, setActiveStory] = useState<{ title: string; paragraphs: string[] } | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);

  const activeStoryRef = useRef<{ title: string; paragraphs: string[] } | null>(null);
  const activeParagraphIndexRef = useRef<number>(0);

  // Fetch historic data
  const fetchStatsAndHistory = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await db.getTypingSessions();
      if (res && res.sessions) {
        setHistory(res.sessions);
        
        // Compute high score WPM
        const maxWpm = res.sessions.reduce((max: number, s: TypingSession) => Math.max(max, s.wpm), 0);
        setBestWpm(maxWpm);
      }
    } catch (err) {
      console.error('Failed to load typing speed history:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndHistory();
  }, [fetchStatsAndHistory]);

  const selectRandomText = useCallback((diff: 'easy' | 'medium' | 'hard', avoidText?: string) => {
    const arr = TEXT_PRESETS[diff];
    const filtered = avoidText ? arr.filter(t => t !== avoidText) : arr;
    const pool = filtered.length > 0 ? filtered : arr;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }, []);

  const selectRandomStory = useCallback((diff: 'easy' | 'medium' | 'hard', avoidTitle?: string) => {
    const arr = EPIC_STORIES[diff];
    const filtered = avoidTitle ? arr.filter(s => s.title !== avoidTitle) : arr;
    const pool = filtered.length > 0 ? filtered : arr;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }, []);

  // Web Audio Mechanical Click Generator
  const playTypingSound = useCallback((isSpace: boolean = false, isError: boolean = false) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;

      // Resumes context if suspended due to browser user-gesture restrictions
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      if (isError) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = isSpace ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(isSpace ? 150 : 800 + Math.random() * 200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isSpace ? 50 : 300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      }
    } catch (e) {
      // Ignored if browser policy blocks audio before user interaction
    }
  }, [soundEnabled]);

  // Start Typing Practice Engine
  const startPractice = () => {
    // Reset cumulative stats
    cumulativeCorrectRef.current = 0;
    cumulativeTotalRef.current = 0;
    liveWpmRef.current = 0;
    liveAccRef.current = 100;

    // Pick an epic story based on selected difficulty
    const story = selectRandomStory(difficulty);
    setActiveStory(story);
    activeStoryRef.current = story;

    let text = "";
    if (textOption === 'long') {
      // For "long" mode: a full amazing and cohesive story formed by joining all paragraphs
      text = story.paragraphs.join(" ");
      setActiveParagraphIndex(0);
      activeParagraphIndexRef.current = 0;
    } else if (textOption === 'endless') {
      // For "endless" mode: start with the first paragraph and stream chapter-by-chapter
      text = story.paragraphs[0];
      setActiveParagraphIndex(0);
      activeParagraphIndexRef.current = 0;
    } else {
      // Standard single-block mode: pick a random chapter of this fun story
      const pIndex = Math.floor(Math.random() * story.paragraphs.length);
      text = story.paragraphs[pIndex];
      setActiveParagraphIndex(pIndex);
      activeParagraphIndexRef.current = pIndex;
    }

    setTargetText(text);
    setTypedInput('');
    setStartTime(null);
    setElapsedSeconds(0);
    setErrorCount(0);
    setWpm(0);
    setAccuracy(100);
    
    let duration = 30;
    if (pacingMode === '60s') duration = 60;
    if (pacingMode === 'free') duration = 999;
    
    setTimeLeft(duration);
    setGameState('playing');
    
    // Auto focus on target input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleFinishPractice = useCallback(async (finalWpm: number, finalAccuracy: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('completed');
    
    // Save to Postgres DB
    setSavingSession(true);
    try {
      const secondsRun = pacingMode === '30s' ? 30 : (pacingMode === '60s' ? 60 : elapsedSeconds);
      await db.saveTypingSession({
        wpm: finalWpm,
        accuracy: finalAccuracy,
        difficulty,
        duration_seconds: secondsRun <= 0 ? 1 : secondsRun
      });
      // Fetch fresh stats
      await fetchStatsAndHistory();
    } catch (err) {
      console.error('Failed to save session metrics to DB:', err);
    } finally {
      setSavingSession(false);
    }
  }, [difficulty, pacingMode, elapsedSeconds, fetchStatsAndHistory]);

  // Handle live inputs and evaluate typing progression
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    
    // Timer starts immediately upon typing the first key
    if (startTime === null && inputVal.length > 0) {
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const nextVal = prev + 1;
          
          if (pacingMode !== 'free') {
            setTimeLeft(time => {
              if (time <= 1) {
                // Completed due to time expiration - avoid stale closure variables by reading from up-to-date refs
                handleFinishPractice(liveWpmRef.current, liveAccRef.current);
                return 0;
              }
              return time - 1;
            });
          }
          return nextVal;
        });
      }, 1000);
    }

    // Capture mistakes vs space/corrections sound clicks
    if (inputVal.length > typedInput.length) {
      const newlyTypedChar = inputVal[inputVal.length - 1];
      const correspondingTargetChar = targetText[inputVal.length - 1];
      const isSpace = newlyTypedChar === ' ';
      const isWrong = newlyTypedChar !== correspondingTargetChar;
      
      if (isWrong) {
        setErrorCount(errs => errs + 1);
        playTypingSound(isSpace, true);
      } else {
        playTypingSound(isSpace, false);
      }
    } else {
      // Key deletion
      playTypingSound(false, false);
    }

    setTypedInput(inputVal);

    // Calculate real-time stats
    if (inputVal.length > 0) {
      let currentCorrectChars = 0;
      for (let i = 0; i < inputVal.length; i++) {
        if (inputVal[i] === targetText[i]) {
          currentCorrectChars++;
        }
      }

      const totalCorrect = cumulativeCorrectRef.current + currentCorrectChars;
      const totalTyped = cumulativeTotalRef.current + inputVal.length;

      // Word calculation: standard typist calculation takes (characters / 5) as standard word count
      const elapsedMinutes = (startTime ? (Date.now() - startTime) : 1) / 60000;
      const computedWpm = Math.max(0, Math.round((totalCorrect / 5) / (elapsedMinutes || 0.01)));
      setWpm(computedWpm);

      const computedAcc = Math.round((totalCorrect / totalTyped) * 100);
      setAccuracy(computedAcc);

      // Save to refs to keep them always fresh for the timer interval closure callback
      liveWpmRef.current = computedWpm;
      liveAccRef.current = computedAcc;

      // Check for completion of entire sentence
      if (inputVal.length === targetText.length) {
        if (textOption === 'endless') {
          // Endless text mode: transition to next sentence block seamlessly
          cumulativeCorrectRef.current += currentCorrectChars;
          cumulativeTotalRef.current += targetText.length;
          setTypedInput('');
          
          const s = activeStoryRef.current;
          if (s) {
            const nextIdx = activeParagraphIndexRef.current + 1;
            if (nextIdx < s.paragraphs.length) {
              setActiveParagraphIndex(nextIdx);
              activeParagraphIndexRef.current = nextIdx;
              setTargetText(s.paragraphs[nextIdx]);
            } else {
              // Move to a new story of the current difficulty!
              const nextStory = selectRandomStory(difficulty, s.title);
              setActiveStory(nextStory);
              activeStoryRef.current = nextStory;
              setActiveParagraphIndex(0);
              activeParagraphIndexRef.current = 0;
              setTargetText(nextStory.paragraphs[0]);
            }
          } else {
            // Fallback story picker
            const rStory = selectRandomStory(difficulty);
            setActiveStory(rStory);
            activeStoryRef.current = rStory;
            setActiveParagraphIndex(0);
            activeParagraphIndexRef.current = 0;
            setTargetText(rStory.paragraphs[0]);
          }
        } else {
          // Standard / long single text mode
          handleFinishPractice(computedWpm, computedAcc);
        }
      }
    }
  };

  // Reset or abort active game
  const resetPractice = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('select');
    setTypedInput('');
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Compute stats metrics
  const totalSessionsCount = history.length;
  const avgWpm = totalSessionsCount > 0 
    ? Math.round(history.reduce((sum, s) => sum + s.wpm, 0) / totalSessionsCount)
    : 0;
  const avgAccuracy = totalSessionsCount > 0
    ? Math.round(history.reduce((sum, s) => sum + s.accuracy, 0) / totalSessionsCount)
    : 0;

  // Chart data calculation
  const chartData = [...history]
    .reverse()
    .slice(-15) // take the 15 most recent tests for cleaner trends
    .map((s, index) => ({
      index: index + 1,
      WPM: s.wpm,
      Accuracy: s.accuracy,
      Date: new Date(s.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }));

  const getPerformanceBadge = (speed: number, acc: number) => {
    if (speed >= 125) return { title: "Cosmic Speed Typist", color: "from-fuchsia-500 to-indigo-500", desc: "Mind-shattering legend on fingers." };
    if (speed >= 95) return { title: "Typing Grandmaster", color: "from-amber-400 to-orange-500", desc: "Blistering precision, professional cadence." };
    if (speed >= 75) return { title: "Acrobatic Fingertips", color: "from-emerald-400 to-cyan-500", desc: "Excellence in muscle memory sprints." };
    if (speed >= 50) return { title: "Steady Runner", color: "from-blue-400 to-purple-500", desc: "Solid rhythmic velocity, moving upwards." };
    return { title: "Developing Craftsman", color: "from-slate-400 to-slate-500", desc: "Keep practicing daily, progress is coming." };
  };

  const badge = getPerformanceBadge(wpm, accuracy);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Visual background elements */}
      <div className="absolute top-12 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-secondary to-pink-500" />
      
      {/* Top action header info */}
      <div className="px-6 py-4 border-b border-primary/10 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center shadow-md shadow-primary/20">
            <Keyboard size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
              Typing Speed Sprint
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 bg-secondary/10 text-secondary rounded-full border border-secondary/20">SQL Studio Edition</span>
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Practice real word paragraphs, elevate speed, and track historical productivity charts.</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-primary/10 dark:border-slate-800">
          <button 
            onClick={() => setCurrentTab('trainer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentTab === 'trainer' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            <Play size={13} />
            Practice Mode
          </button>
          
          <button 
            onClick={() => { setCurrentTab('dashboard'); fetchStatsAndHistory(); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentTab === 'dashboard' ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
          >
            <BarChart3 size={13} />
            Analytics Board
          </button>

          {onBackToExplorer && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
              <button 
                onClick={onBackToExplorer}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                title="Return to database queries explorer"
              >
                Query Studio &rarr;
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between max-w-5xl mx-auto w-full">
        {currentTab === 'trainer' ? (
          <AnimatePresence mode="wait">
            
            {/* STAGE 1: SETTING & PREPARATIONS SELECTOR */}
            {gameState === 'select' && (
              <motion.div 
                key="select-mode"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-2 mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider mb-2">
                    <Sparkles size={11} className="text-primary animate-pulse" /> Immersive Story Typing Mode Enabled
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Select Typing Difficulty & Story Mode</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                    Type full, fun, and amazing fantasy, sci-fi, & cyberpunk adventure stories! Perfect for calibrating your fingers with continuous prose narrative flows.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
                  
                  {/* Select Difficulty */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-primary/10 dark:border-slate-800/80 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold uppercase text-slate-400">1. Difficulty</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Sparsely vocabulary complexity escalates.</p>
                    </div>
                    <div className="space-y-2">
                      {(['easy', 'medium', 'hard'] as const).map(diff => (
                        <button
                          key={diff}
                          onClick={() => setDifficulty(diff)}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${difficulty === diff ? 'bg-primary text-white border-primary shadow-sm hover:opacity-90' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen size={13} />
                            {diff}
                          </span>
                          {diff === 'easy' && <span className="text-[8px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">Basic</span>}
                          {diff === 'medium' && <span className="text-[8px] font-extrabold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase">General</span>}
                          {diff === 'hard' && <span className="text-[8px] font-extrabold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full uppercase">Advanced</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Game Mode */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-primary/10 dark:border-slate-800/80 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold uppercase text-slate-400">2. Pacing Mode</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Duration parameters to calibrate endurance limits.</p>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => setPacingMode('30s')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${pacingMode === '30s' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                      >
                        <span className="flex items-center gap-2"><Zap size={13} /> 30-Second Sprint</span>
                        <span className="text-[9px] opacity-75 font-mono">Time attack</span>
                      </button>

                      <button
                        onClick={() => setPacingMode('60s')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${pacingMode === '60s' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                      >
                        <span className="flex items-center gap-2"><Calendar size={13} /> 60-Second Endurance</span>
                        <span className="text-[9px] opacity-75 font-mono">Precision hold</span>
                      </button>

                      <button
                        onClick={() => setPacingMode('free')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${pacingMode === 'free' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                      >
                        <span className="flex items-center gap-2"><BookOpen size={13} /> Complete Paragraph</span>
                        <span className="text-[9px] opacity-75 font-mono">Pace yourself</span>
                      </button>
                    </div>
                  </div>

                  {/* Select Text option */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-primary/10 dark:border-slate-800/80 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold uppercase text-slate-400">3. Narrative Mode</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Configure story pacing boundaries for custom typing calibration.</p>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => setTextOption('standard')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${textOption === 'standard' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                        title="Focus on a single chapter segment and polish your execution metrics"
                      >
                        <span className="flex items-center gap-2"><Type size={13} /> Single Chapter</span>
                        <span className="text-[8px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">Single</span>
                      </button>

                      <button
                        onClick={() => setTextOption('long')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${textOption === 'long' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                        title="Concatenates all story chapters sequentially so you can type the entire story adventure in one long run!"
                      >
                        <span className="flex items-center gap-2"><BookOpen size={13} /> Full Story Arc</span>
                        <span className="text-[8px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">Complete</span>
                      </button>

                      <button
                        onClick={() => setTextOption('endless')}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-between ${textOption === 'endless' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-primary/5 dark:border-slate-800 hover:bg-slate-100'}`}
                        title="New story chapters are seamlessly updated at the end of each block so you can practice without interrupting your flow"
                      >
                        <span className="flex items-center gap-2">
                          <Flame size={13} className={textOption === 'endless' ? 'text-white' : 'text-slate-400'} /> 
                          Endless Odyssey
                        </span>
                        <span className="text-[8px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full animate-pulse">Endless</span>
                      </button>
                    </div>
                  </div>

                  {/* Font Customization & Audio Toggle */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-primary/10 dark:border-slate-800/80 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold uppercase text-slate-400">4. Workspace Details</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Fine-tune the typography and audio feedback options.</p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-950 border border-primary/5 dark:border-slate-800 rounded-xl">
                        {(['sans', 'mono', 'serif'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setFontStyle(f)}
                            className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase rounded-lg transition-all ${fontStyle === f ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${soundEnabled ? 'bg-slate-50 dark:bg-slate-900/60 border-indigo-500/20 text-indigo-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-primary/5 dark:border-slate-800'}`}
                      >
                        <span className="flex items-center gap-2">
                          {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                          Synthesized Click Sounds
                        </span>
                        <span className="text-[8px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full">WebAudio</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-2 max-w-xs mx-auto w-full">
                  <button
                    onClick={startPractice}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-extrabold text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={16} fill="white" className="mt-0.5" /> Start Practice Game
                  </button>
                </div>

                {/* Micro stat footer summaries */}
                <div className="border-t border-primary/5 dark:border-slate-800 pt-6 max-w-xl mx-auto w-full flex justify-around text-center">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global WPM Best</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white font-mono">{bestWpm} WPM</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Runs Completed</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white font-mono">{totalSessionsCount}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Accuracy</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white font-mono">{avgAccuracy}%</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STAGE 2: ACTIVE PLAY LAYOUT ENGINE */}
            {gameState === 'playing' && (
              <motion.div 
                key="playing-mode"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                {/* Stats board top bar */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 border border-primary/5 dark:border-slate-800 max-w-4xl mx-auto w-full">
                  <div className="flex items-center gap-12 font-mono">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Elapsed Time</p>
                      <div className="text-xl font-black text-primary flex items-baseline gap-1">
                        {pacingMode === 'free' ? (
                          <>
                            {elapsedSeconds}
                            <span className="text-[10px] text-slate-400">s</span>
                          </>
                        ) : (
                          <>
                            {timeLeft}
                            <span className="text-[10px] text-slate-400">s left</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Live Speed</p>
                      <div className="text-xl font-black text-emerald-500">
                        {wpm} <span className="text-[10px] text-slate-400 uppercase">WPM</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Accuracy</p>
                      <div className={`text-xl font-black ${accuracy >= 95 ? 'text-primary' : (accuracy >= 85 ? 'text-amber-500' : 'text-rose-500')}`}>
                        {accuracy}%
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Errors</p>
                      <div className={`text-xl font-black ${errorCount > 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {errorCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Difficulty</span>
                      <span className="text-xs uppercase font-black text-slate-600 dark:text-slate-300 tracking-wider font-mono">{difficulty}</span>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button 
                      onClick={resetPractice}
                      className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-900 transition-colors"
                      title="Aborts this test session and returns back to difficulty screen"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                {activeStory && (
                  <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5 rounded-full border border-primary/5 dark:border-slate-800 animate-fade-in">
                      <BookOpen size={12} className="text-primary dark:text-indigo-400" />
                      <strong className="text-slate-800 dark:text-slate-200">Story:</strong> {activeStory.title}
                    </span>
                    {textOption === 'endless' && (
                      <span className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/5 px-3 py-1.5 rounded-full border border-teal-500/20 flex items-center gap-1 animate-pulse">
                        <Sparkles size={11} className="text-teal-500" /> Chapter {activeParagraphIndex + 1} of {activeStory.paragraphs.length} (Endless Flow)
                      </span>
                    )}
                    {textOption === 'long' && (
                      <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/5 px-3 py-1.5 rounded-full border border-purple-500/20">
                        Full Story Arc (Typing Complete Chapters)
                      </span>
                    )}
                    {textOption === 'standard' && (
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/20">
                        Single Paragraph Block
                      </span>
                    )}
                  </div>
                )}

                {/* The main text typing layout */}
                <div className="max-w-4xl mx-auto w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-md relative min-h-[160px] flex items-center">
                  <div className={`text-lg leading-relaxed select-none tracking-wide text-justify w-full 
                    ${fontStyle === 'mono' ? 'font-mono text-base' : ''}
                    ${fontStyle === 'serif' ? 'font-serif text-xl font-normal text-slate-700 dark:text-slate-200' : ''}
                    ${fontStyle === 'sans' ? 'font-sans' : ''}
                  `}>
                    {targetText.split('').map((char, index) => {
                      let colorClass = "text-slate-300 dark:text-slate-700";
                      let activeClass = "";

                      if (index < typedInput.length) {
                        colorClass = typedInput[index] === char 
                          ? "text-emerald-500 dark:text-emerald-400 font-medium" 
                          : "text-rose-500 dark:text-rose-400 font-extrabold bg-rose-500/10 decoration-red-500 px-0.5 rounded";
                      } else if (index === typedInput.length) {
                        colorClass = "text-primary dark:text-white font-extrabold";
                        activeClass = "border-b-2 border-primary dark:border-indigo-400 animate-pulse";
                      }

                      return (
                        <span key={index} className={`${colorClass} ${activeClass}`}>
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-surface hidden input which drives execution */}
                <div className="max-w-lg mx-auto w-full space-y-4">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={typedInput}
                      onChange={handleInputChange}
                      className="w-full py-4 px-6 rounded-2xl bg-white dark:bg-slate-950 border border-primary/20 dark:border-slate-800 focus:border-primary/60 outline-none text-slate-900 dark:text-white text-sm font-semibold tracking-wide pr-12 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                      placeholder="Start typing the text block above to start your speed test..."
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-50">
                      <Keyboard size={16} className="text-slate-400 animate-pulse" />
                    </div>
                  </div>
                  
                  {/* Floating visual encouragement based on accuracy */}
                  <div className="text-center font-mono text-[10px] text-slate-400">
                    {startTime === null ? (
                      <span className="animate-bounce inline-block text-secondary font-bold">Press any letter to trigger the clock</span>
                    ) : (
                      <div className="flex flex-col items-center gap-2.5">
                        <span className="text-emerald-500/80 uppercase font-black tracking-widest flex items-center justify-center gap-1.5">
                          <Flame size={12} className="animate-bounce" /> Focus on accurate muscle calibration
                        </span>
                        
                        {(textOption === 'endless' || pacingMode === 'free') && (
                          <div className="flex justify-center mt-1">
                            <button
                              onClick={() => handleFinishPractice(wpm, accuracy)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle size={11} /> Finish & Save Session
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STAGE 3: INTERACTIVE COMPLETION SCREEN */}
            {gameState === 'completed' && (
              <motion.div 
                key="completed-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-1">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-sm">
                    <Award size={36} className="text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Session Run Complete!</h3>
                  <p className="text-xs text-slate-500">Your velocity metrics have been saved as historical logs in standard PostgreSQL.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 dark:border-slate-800 text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Final Speed</span>
                    <h4 className="text-3xl font-black text-primary font-mono">{wpm} WPM</h4>
                    <p className="text-[10px] text-slate-400">Words Per Minute</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 dark:border-slate-800 text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Accuracy achieved</span>
                    <h4 className={`text-3xl font-black font-mono ${accuracy >= 95 ? 'text-emerald-500' : 'text-slate-400'}`}>{accuracy}%</h4>
                    <p className="text-[10px] text-slate-400">With {errorCount} errors</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 dark:border-slate-800 text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Session details</span>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-2xl dark:text-white dark:pt-1 truncate capitalize">{difficulty}</h4>
                    <p className="text-[10px] text-slate-400">Difficulty Index</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 dark:border-slate-800 text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Time consumed</span>
                    <h4 className="text-3xl font-black text-secondary font-mono">
                      {pacingMode === '30s' ? 30 : (pacingMode === '60s' ? 60 : elapsedSeconds)}s
                    </h4>
                    <p className="text-[10px] text-slate-400">Active pacing sprint</p>
                  </div>
                </div>

                {/* Premium Typist Badge card */}
                <div className={`max-w-lg mx-auto w-full p-6 rounded-3xl bg-gradient-to-r ${badge.color} text-white space-y-2 text-center shadow-lg relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 py-1.5 px-3 bg-white/20 text-[8px] font-bold uppercase tracking-wider rounded-bl-xl">Official Metric Match</div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle size={16} />
                    <span className="text-[10px] uppercase font-black tracking-widest">Achieved Performance Tier</span>
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-tight">{badge.title}</h4>
                  <p className="text-xs text-white/90 leading-relaxed font-semibold">{badge.desc}</p>
                </div>

                <div className="flex justify-center gap-4 max-w-sm mx-auto w-full">
                  <button
                    onClick={startPractice}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-primary/5 dark:border-slate-800 text-xs font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} /> Repeat test
                  </button>

                  <button
                    onClick={() => setGameState('select')}
                    className="flex-1 py-3 px-4 rounded-xl bg-primary text-white text-xs font-extrabold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
                  >
                    Change settings <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        ) : (
          
          /* PAGE 2: STATS INTERACTIVE ANALYTICS DASHBOARD */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 flex-1"
          >
            {/* Overview dashboard totals row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Average speed</span>
                  <h3 className="text-3xl font-black text-primary font-mono">{avgWpm} <span className="text-xs font-bold text-slate-500 uppercase">WPM</span></h3>
                  <p className="text-[10px] text-slate-400">Total lifetime benchmark</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Peak record</span>
                  <h3 className="text-3xl font-black text-amber-500 font-mono">{bestWpm} <span className="text-xs font-bold text-slate-500 uppercase">WPM</span></h3>
                  <p className="text-[10px] text-slate-400">Maximum registered index</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Star size={20} />
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Average Accuracy</span>
                  <h3 className="text-3xl font-black text-emerald-500 font-mono">{avgAccuracy}%</h3>
                  <p className="text-[10px] text-slate-400">Steady muscle configuration</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle size={20} />
                </div>
              </div>
            </div>

            {/* Recharts Graphical Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Plot progression graph */}
              <div className="col-span-1 lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider">Finger Velocity Progression</h4>
                    <p className="text-[10px] text-slate-400">Graphing standard words-per-minute speed and coordinate accuracy across session records.</p>
                  </div>
                </div>

                <div className="h-[240px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800/60" />
                        <XAxis dataKey="index" stroke="#94a3b8" fontSize={10} fontWeight="600" />
                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="600" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                            border: 'none', 
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}
                        />
                        <Area type="monotone" dataKey="WPM" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorWpm)" />
                        <Area type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAcc)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center opacity-30 gap-2">
                      <BarChart3 size={24} />
                      <span className="text-[10px] font-bold uppercase">No records found. Complete a typing run first.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* History list logger panel */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-primary/5 dark:border-slate-800/80 pb-3">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-2">
                    <History size={13} className="text-primary" /> Session Run Logs
                  </h4>
                  <span className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">{history.length} runs</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin max-h-[220px]">
                  {history.slice(0, 50).map((session) => (
                    <div 
                      key={session.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-primary/5 dark:border-slate-800/60 flex items-center justify-between group hover:border-primary/20 transition-all font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">{session.wpm} <span className="text-[9px] text-slate-400">WPM</span></span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${session.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-500' : (session.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-500' : 'bg-pink-500/10 text-pink-500')}`}>
                            {session.difficulty}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400">{new Date(session.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-extrabold text-primary block">{session.accuracy}% <span className="text-[8px] text-slate-400">acc</span></span>
                        <span className="text-[9px] text-slate-400 font-medium">{session.duration_seconds}s run</span>
                      </div>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <div className="py-10 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-35">No saved runs</div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </div>

      {/* Dashboard mini footer status */}
      <div className="px-6 py-2 bg-slate-100/50 dark:bg-slate-950/40 border-t border-primary/10 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1"><ShieldAlert size={10} strokeWidth={3} /> Database Connection Encoded: PG_SSL</span>
        <span>Developer sandbox v1.0.1</span>
      </div>
    </div>
  );
}
