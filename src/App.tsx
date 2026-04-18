/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useParams
} from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { Trip, Expense, CATEGORIES, Category, UserSettings, DEFAULT_PAYMENT_SOURCES } from './types';
import { generateTripReport } from './lib/pdf';
import { format, differenceInDays, startOfDay, isBefore } from 'date-fns';
import { 
  Menu, 
  User as UserIcon, 
  Compass, 
  PlusCircle, 
  BarChart3, 
  Settings as SettingsIcon,
  ArrowLeft,
  Save,
  FileText,
  TrendingDown,
  Hotel,
  Train,
  Utensils,
  ShoppingBag,
  MoreHorizontal,
  StickyNote,
  Calendar,
  Wallet,
  Plus,
  Rocket,
  ChevronRight,
  Edit2,
  Trash2,
  Archive,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Context ---
const AuthContext = createContext<{ user: User | null; loading: boolean; settings: UserSettings }>({ 
  user: null, 
  loading: true, 
  settings: { payment_sources: DEFAULT_PAYMENT_SOURCES } 
});
const ToastContext = createContext<{ showToast: (msg: string, type?: 'success' | 'error') => void }>({ showToast: () => {} });

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md ${
      type === 'success' ? 'bg-primary/90 text-white' : 'bg-error/90 text-white'
    }`}
  >
    {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
    <span className="font-body font-bold text-sm whitespace-nowrap">{message}</span>
  </motion.div>
);

const LoadingSpinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
  <motion.div 
    animate={{ rotate: 360 }} 
    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    className={`text-primary ${className}`}
  >
    <Loader2 size={size} />
  </motion.div>
);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({ payment_sources: DEFAULT_PAYMENT_SOURCES });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Fetch user settings
        const settingsRef = doc(db, 'user_settings', user.uid);
        unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
          if (docSnap.exists()) {
            setSettings(docSnap.data() as UserSettings);
          } else {
            // Initialize default settings if not exists
            setSettings({ payment_sources: DEFAULT_PAYMENT_SOURCES });
          }
        });
      } else {
        if (unsubscribeSettings) unsubscribeSettings();
        setSettings({ payment_sources: DEFAULT_PAYMENT_SOURCES });
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AuthContext.Provider value={{ user, loading, settings }}>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        <AnimatePresence>
          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
};

// --- Components ---

const Layout: React.FC<{ children: React.ReactNode; title?: string; showBack?: boolean }> = ({ children, title = 'TripLedger', showBack = false }) => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-32 font-body">
      <header className="bg-[#f9f9f9]/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6 py-4 w-full border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          {showBack ? (
            <button onClick={() => navigate(-1)} className="text-primary p-2 rounded-full hover:bg-surface-container-high transition-colors">
              <ArrowLeft size={24} />
            </button>
          ) : (
            <button className="text-slate-500 p-2 rounded-full hover:bg-surface-container-high transition-colors">
              <Menu size={24} />
            </button>
          )}
          <h1 className="font-headline font-extrabold text-primary tracking-tighter text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <button onClick={() => signOut(auth)} className="text-slate-500 p-2 rounded-full hover:bg-surface-container-high transition-colors">
              <UserIcon size={24} />
            </button>
          )}
        </div>
      </header>
      
      <main className="max-w-xl mx-auto px-6 pt-8">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pt-3 pb-6 bg-[#f9f9f9]/80 backdrop-blur-xl rounded-t-2xl z-50 shadow-[0_-12px_32px_-4px_rgba(26,28,28,0.06)]">
        <button onClick={() => navigate('/')} className="flex flex-col items-center justify-center text-slate-500 px-4 py-1 hover:text-primary active:scale-90 transition-transform">
          <Compass size={24} />
          <span className="font-medium uppercase tracking-[0.05em] text-[10px] mt-1">Trips</span>
        </button>
        <button onClick={() => navigate('/log')} className="flex flex-col items-center justify-center text-slate-500 px-4 py-1 hover:text-primary active:scale-90 transition-transform">
          <PlusCircle size={24} />
          <span className="font-medium uppercase tracking-[0.05em] text-[10px] mt-1">Log</span>
        </button>
        <button onClick={() => navigate('/analytics')} className="flex flex-col items-center justify-center text-slate-500 px-4 py-1 hover:text-primary active:scale-90 transition-transform">
          <BarChart3 size={24} />
          <span className="font-medium uppercase tracking-[0.05em] text-[10px] mt-1">Charts</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex flex-col items-center justify-center text-slate-500 px-4 py-1 hover:text-primary active:scale-90 transition-transform">
          <SettingsIcon size={24} />
          <span className="font-medium uppercase tracking-[0.05em] text-[10px] mt-1">Settings</span>
        </button>
      </nav>
    </div>
  );
};

const Login = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4 font-body">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        <div className="hidden md:flex md:col-span-7 rounded-[2rem] overflow-hidden relative min-h-[500px] shadow-[0_12px_32px_-4px_rgba(26,28,28,0.06)] group">
          <div className="absolute inset-0 bg-primary/10 mix-blend-multiply z-10"></div>
          <img 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            src="https://picsum.photos/seed/travel/1200/800" 
            alt="Travel"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-12 left-12 z-20 max-w-sm">
            <h1 className="font-headline font-extrabold text-4xl text-white tracking-tight mb-4 drop-shadow-sm">Precision in every mile.</h1>
            <p className="text-white/90 font-body text-lg leading-relaxed drop-shadow-sm">Track your journey with editorial clarity. The sophisticated way to manage travel expenses.</p>
          </div>
        </div>
        <div className="md:col-span-5 flex flex-col justify-center bg-surface-container-lowest rounded-[2rem] p-8 md:p-12 shadow-[0_12px_32px_-4px_rgba(26,28,28,0.06)]">
          <div className="mb-10">
            <span className="font-label font-medium uppercase tracking-[0.05em] text-[10px] text-primary mb-2 block">Welcome Back</span>
            <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight">Log in to your ledger</h2>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-full border border-outline-variant/30 hover:bg-surface-container-low transition-all active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="font-body font-semibold text-on-surface">Sign in with Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'trips'), where('user_email', '==', user.email), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trips');
      setLoading(false);
    });
  }, [user]);

  const filteredTrips = trips.filter(t => showArchived ? t.archived : !t.archived);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size={48} />
          <p className="text-outline font-medium animate-pulse">Syncing your ledgers...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mb-10">
        <div className="bg-surface-container-lowest p-6 rounded-xl border-l-4 border-primary shadow-[0_12px_32px_-4px_rgba(26,28,28,0.06)]">
          <p className="font-label text-[10px] uppercase tracking-[0.1em] text-outline mb-1">Total Active Budget</p>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-extrabold text-4xl text-on-surface">
              ₹{trips.filter(t => !t.archived).reduce((acc, trip) => acc + Object.values(trip.budget).reduce((a: number, b: number) => a + b, 0), 0).toLocaleString()}
            </span>
            <span className="font-label text-sm text-outline font-medium tracking-tight">INR</span>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-headline font-bold text-lg text-on-surface">
          {showArchived ? 'Archived Trips' : 'Active Trips'}
        </h2>
        <button 
          onClick={() => setShowArchived(!showArchived)}
          className="text-primary font-label text-xs font-bold uppercase tracking-wider"
        >
          {showArchived ? 'View Active' : 'View Archived'}
        </button>
      </div>

      <div className="space-y-6">
        {filteredTrips.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
            <p className="text-outline font-medium">No {showArchived ? 'archived' : 'active'} trips found.</p>
          </div>
        ) : filteredTrips.map(trip => (
          <motion.div 
            key={trip.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_-4px_rgba(26,28,28,0.06)] overflow-hidden flex flex-col transition-transform active:scale-[0.98] cursor-pointer"
          >
            <div className="relative h-32 w-full">
              <img 
                className="w-full h-full object-cover" 
                src={`https://picsum.photos/seed/${encodeURIComponent(trip.trip_name.toLowerCase())}/800/400`} 
                alt={trip.trip_name}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-4 left-6">
                <h3 className="font-headline font-extrabold text-white text-xl">{trip.trip_name}</h3>
              </div>
            </div>
            <div className="p-6 border-l-4 border-primary">
              <div className="flex justify-between items-end">
                <div>
                  <p className="font-label text-[10px] uppercase tracking-wider text-outline">Budget</p>
                  <p className="font-headline font-bold text-xl text-on-surface">
                    ₹{Object.values(trip.budget).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                  </p>
                </div>
                <ChevronRight className="text-outline-variant" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button 
        onClick={() => navigate('/new-trip')}
        className="fixed bottom-24 right-6 bg-gradient-to-br from-primary to-primary-container text-white p-4 rounded-full shadow-lg z-40 active:scale-90 transition-transform"
      >
        <Plus size={32} />
      </button>
    </Layout>
  );
};

const TripDetails = () => {
  const { tripId } = useParams();
  const { showToast } = useContext(ToastContext);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const navigate = useNavigate();

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteDoc(doc(db, `trips/${tripId}/expenses`, expenseId));
      setDeletingId(null);
      showToast('Expense removed successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${tripId}/expenses/${expenseId}`);
      showToast('Failed to remove expense', 'error');
    }
  };

  const handleArchiveTrip = async () => {
    if (!tripId) return;
    try {
      const newStatus = !trip?.archived;
      await updateDoc(doc(db, 'trips', tripId), {
        archived: newStatus
      });
      showToast(newStatus ? 'Trip archived' : 'Trip restored');
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
      showToast('Failed to update trip', 'error');
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripId) return;
    try {
      await deleteDoc(doc(db, 'trips', tripId));
      showToast('Trip deleted permanently');
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${tripId}`);
      showToast('Failed to delete trip', 'error');
    }
  };

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    const tripDoc = doc(db, 'trips', tripId);
    getDoc(tripDoc).then(s => {
      setTrip({ id: s.id, ...s.data() } as Trip);
      setLoading(false);
    });

    const q = query(collection(db, `trips/${tripId}/expenses`), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `trips/${tripId}/expenses`));
  }, [tripId]);

  if (loading || !trip) return (
    <Layout title="Loading..." showBack>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <LoadingSpinner size={48} />
        <p className="text-outline font-medium animate-pulse">Fetching journey details...</p>
      </div>
    </Layout>
  );

  const totalSpent = expenses.reduce((acc, e) => acc + e.amount_inr, 0);
  const totalBudget = Object.values(trip.budget).reduce((a: number, b: number) => a + b, 0) as number;

  return (
    <Layout title={trip.trip_name} showBack>
      <div className="flex justify-end gap-4 mb-4">
        <button 
          onClick={() => generateTripReport(trip, expenses)}
          className="flex items-center gap-2 text-primary font-bold text-sm bg-surface-container-lowest py-2 px-4 rounded-full shadow-sm border border-outline-variant/10 hover:bg-surface-container-low transition-colors"
        >
          <FileText size={18} /> PDF
        </button>
        <button 
          onClick={() => navigate(`/trip/${tripId}/edit`)}
          className="flex items-center justify-center w-10 h-10 text-outline bg-surface-container-lowest rounded-full shadow-sm border border-outline-variant/10 hover:text-primary hover:bg-surface-container-low transition-colors"
          title="Edit Trip Settings"
        >
          <Edit2 size={18} />
        </button>
        <button 
          onClick={handleArchiveTrip}
          className="flex items-center justify-center w-10 h-10 text-outline bg-surface-container-lowest rounded-full shadow-sm border border-outline-variant/10 hover:text-primary hover:bg-surface-container-low transition-colors"
          title={trip.archived ? "Unarchive Trip" : "Archive Trip"}
        >
          <Archive size={18} />
        </button>
        <button 
          onClick={() => setIsDeletingTrip(true)}
          className="flex items-center justify-center w-10 h-10 text-outline bg-surface-container-lowest rounded-full shadow-sm border border-outline-variant/10 hover:text-error hover:bg-surface-container-low transition-colors"
          title="Delete Trip"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_-4px_rgba(26,28,28,0.06)] border-l-4 border-primary mb-8">
        <p className="font-label text-[10px] uppercase tracking-[0.1em] text-outline mb-2">Total Budget Status</p>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-headline text-5xl font-extrabold tracking-tighter text-primary">₹{totalSpent.toLocaleString()}</span>
          <span className="font-label text-sm text-outline">Spent</span>
        </div>
        <p className="text-on-surface-variant text-sm mb-8">
          You have utilized <span className="font-bold text-secondary">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</span> of your ₹{totalBudget.toLocaleString()} total budget.
        </p>
        <div className="w-full bg-surface-container-high h-4 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full" style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }}></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-headline font-bold text-lg">Expenses</h2>
      </div>

      <div className="space-y-4">
        {expenses.map(expense => (
          <div key={expense.id} className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-outline flex justify-between items-center group">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-on-surface">{CATEGORIES.find(c => c.value === expense.category)?.label}</p>
                {expense.payment_source && (
                  <span className="text-[10px] font-label font-bold bg-surface-container-high px-2 py-0.5 rounded-full text-outline uppercase tracking-wider">
                    {expense.payment_source}
                  </span>
                )}
              </div>
              <p className="text-xs text-outline">{format(expense.date.toDate(), 'MMM dd, yyyy')}</p>
              {expense.notes && <p className="text-xs text-on-surface-variant mt-1 italic">"{expense.notes}"</p>}
            </div>
            <div className="flex items-center gap-4">
              <p className="font-headline font-bold text-primary">₹{expense.amount_inr.toLocaleString()}</p>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => navigate(`/trip/${tripId}/expense/${expense.id}/edit`)}
                  className="p-2 text-outline hover:text-primary hover:bg-surface-container rounded-full transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => setDeletingId(expense.id)}
                  className="p-2 text-outline hover:text-error hover:bg-error/10 rounded-full transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {deletingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="font-headline font-bold text-xl mb-2">Delete Expense?</h3>
              <p className="text-on-surface-variant text-sm mb-8">This action cannot be undone. Are you sure you want to remove this entry?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 px-4 rounded-full font-bold text-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteExpense(deletingId)}
                  className="flex-1 py-3 px-4 rounded-full font-bold text-sm bg-error text-white hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isDeletingTrip && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="font-headline font-bold text-xl mb-2 text-error">Delete Entire Trip?</h3>
              <p className="text-on-surface-variant text-sm mb-8">This will permanently delete "{trip.trip_name}" and all its recorded expenses. This action is irreversible.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeletingTrip(false)}
                  className="flex-1 py-3 px-4 rounded-full font-bold text-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteTrip}
                  className="flex-1 py-3 px-4 rounded-full font-bold text-sm bg-error text-white hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
                >
                  Delete Trip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => navigate(`/trip/${tripId}/log`)}
        className="fixed bottom-24 right-6 bg-gradient-to-br from-primary to-primary-container text-white p-4 rounded-full shadow-lg z-40 active:scale-90 transition-transform"
      >
        <Plus size={32} />
      </button>
    </Layout>
  );
};

const TripForm = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [budget, setBudget] = useState({
    accommodation: 0,
    transport: 0,
    food_activities: 0,
    shopping: 0,
    miscellaneous: 0
  });

  useEffect(() => {
    if (tripId) {
      const fetchTrip = async () => {
        try {
          const docRef = doc(db, 'trips', tripId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Trip;
            setName(data.trip_name);
            setBudget(data.budget);
            if (data.trip_start_date) {
              setStartDate(data.trip_start_date.toDate().toISOString().split('T')[0]);
            }
            if (data.trip_end_date) {
              setEndDate(data.trip_end_date.toDate().toISOString().split('T')[0]);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `trips/${tripId}`);
        }
      };
      fetchTrip();
    }
  }, [tripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const hasNegative = Object.values(budget).some(val => (val as number) < 0);
    if (hasNegative) {
      showToast("All budget values must be non-negative.", "error");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showToast("End date must be after start date.", "error");
      return;
    }

    setLoading(true);
    try {
      const tripData = {
        trip_name: name,
        user_email: user.email,
        budget,
        trip_start_date: new Date(startDate),
        trip_end_date: new Date(endDate),
        updated_at: serverTimestamp()
      };

      if (tripId) {
        await updateDoc(doc(db, 'trips', tripId), tripData);
        showToast('Trip updated successfully');
        navigate(`/trip/${tripId}`);
      } else {
        await addDoc(collection(db, 'trips'), {
          ...tripData,
          created_at: serverTimestamp()
        });
        showToast('Trip initialized successfully');
        navigate('/');
      }
    } catch (error) {
      handleFirestoreError(error, tripId ? OperationType.UPDATE : OperationType.CREATE, 'trips');
      showToast('Failed to save trip', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={tripId ? "Edit Trip Ledger" : "Plan New Journey"} showBack>
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="relative">
          <label className="block font-label text-[10px] uppercase tracking-[0.05em] font-bold text-primary mb-1">Trip Name</label>
          <input 
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-transparent border-0 border-b-2 border-surface-container-highest py-3 px-0 text-xl font-headline font-bold focus:ring-0 placeholder:text-outline-variant/50 transition-all" 
            placeholder="e.g. Summer in Manali" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="block font-label text-[10px] uppercase tracking-[0.05em] font-bold text-primary mb-1">Start Date</label>
            <div className="flex items-center gap-3 border-b-2 border-surface-container-highest py-3">
              <Calendar size={20} className="text-primary" />
              <input 
                required
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-lg font-headline font-bold focus:ring-0" 
              />
            </div>
          </div>
          <div className="relative">
            <label className="block font-label text-[10px] uppercase tracking-[0.05em] font-bold text-primary mb-1">End Date</label>
            <div className="flex items-center gap-3 border-b-2 border-surface-container-highest py-3">
              <Calendar size={20} className="text-primary" />
              <input 
                required
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-lg font-headline font-bold focus:ring-0" 
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-headline font-bold text-lg flex items-center gap-2">
            <Rocket size={20} className="text-primary" /> Budget Categories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.map(cat => (
              <div key={cat.value} className={`bg-surface-container-lowest p-5 rounded-xl shadow-sm border-l-4 border-${cat.color} relative overflow-hidden`}>
                <label className={`font-label text-[10px] uppercase tracking-widest font-bold text-${cat.color}`}>{cat.label}</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-lg font-bold text-${cat.color}`}>₹</span>
                  <input 
                    type="number"
                    min="0"
                    value={budget[cat.value as keyof typeof budget]}
                    onChange={e => setBudget({ ...budget, [cat.value]: Math.max(0, Number(e.target.value)) })}
                    className="w-full bg-transparent border-0 border-b-2 border-surface-container-highest p-0 text-lg font-headline font-bold focus:ring-0" 
                    placeholder="0.00" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary-container/10 p-6 rounded-xl">
          <span className="font-label text-[10px] uppercase tracking-[0.1em] font-bold text-primary">Est. Total Budget</span>
          <p className="text-4xl font-headline font-extrabold text-primary tracking-tight">
            ₹{Object.values(budget).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
          </p>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold py-5 rounded-full shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <LoadingSpinner className="text-white" /> : <>Initialize Ledger <Rocket size={20} /></>}
        </button>
      </form>
    </Layout>
  );
};

const ExpenseForm = () => {
  const navigate = useNavigate();
  const { tripId, expenseId } = useParams();
  const { showToast } = useContext(ToastContext);
  const { settings } = useContext(AuthContext);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('food_activities');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentSource, setPaymentSource] = useState(settings.payment_sources[0] || 'Cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expenseId && tripId) {
      const fetchExpense = async () => {
        try {
          const docRef = doc(db, `trips/${tripId}/expenses`, expenseId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Expense;
            setAmount(data.amount_inr.toString());
            setCategory(data.category);
            setDate(data.date.toDate().toISOString().split('T')[0]);
            setNotes(data.notes || '');
            if (data.payment_source) {
              setPaymentSource(data.payment_source);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `trips/${tripId}/expenses/${expenseId}`);
        }
      };
      fetchExpense();
    }
  }, [expenseId, tripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) return;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      showToast("Please enter a valid non-negative amount.", "error");
      return;
    }
    setLoading(true);
    try {
      const expenseData = {
        amount_inr: Number(amount),
        category,
        date: new Date(date),
        payment_source: paymentSource,
        notes,
        updated_at: serverTimestamp()
      };

      if (expenseId) {
        await updateDoc(doc(db, `trips/${tripId}/expenses`, expenseId), expenseData);
        showToast('Expense updated');
      } else {
        await addDoc(collection(db, `trips/${tripId}/expenses`), {
          ...expenseData,
          created_at: serverTimestamp()
        });
        showToast('Expense logged');
      }
      navigate(`/trip/${tripId}`);
    } catch (error) {
      handleFirestoreError(error, expenseId ? OperationType.UPDATE : OperationType.CREATE, `trips/${tripId}/expenses`);
      showToast('Failed to save expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={expenseId ? "Edit Expense" : "Log Expense"} showBack>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border-l-4 border-primary">
          <label className="font-label text-[10px] uppercase tracking-[0.1em] text-outline font-semibold mb-2 block">Amount (INR)</label>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-headline font-bold text-outline-variant">₹</span>
            <input 
              required
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-5xl font-headline font-extrabold text-primary focus:ring-0 placeholder:text-surface-container-highest" 
              placeholder="0.00" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 border-outline">
            <label className="font-label text-[10px] uppercase tracking-[0.1em] text-outline font-semibold mb-3 block">Date</label>
            <div className="flex items-center gap-3">
              <Calendar size={20} className="text-primary" />
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent border-none p-0 font-body text-on-surface focus:ring-0 w-full" 
              />
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 border-secondary">
            <label className="font-label text-[10px] uppercase tracking-[0.1em] text-outline font-semibold mb-3 block">Category</label>
            <div className="flex items-center gap-3">
              <MoreHorizontal size={20} className="text-secondary" />
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="bg-transparent border-none p-0 font-body text-on-surface focus:ring-0 w-full appearance-none"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 border-primary-container">
          <label className="font-label text-[10px] uppercase tracking-[0.1em] text-outline font-semibold mb-3 block">Payment Source</label>
          <div className="flex items-center gap-3">
            <Wallet size={20} className="text-primary" />
            <select 
              value={paymentSource}
              onChange={e => setPaymentSource(e.target.value)}
              className="bg-transparent border-none p-0 font-body text-on-surface focus:ring-0 w-full appearance-none"
            >
              <option value="">Select Payment Source</option>
              {settings.payment_sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 border-tertiary">
          <label className="font-label text-[10px] uppercase tracking-[0.1em] text-outline font-semibold mb-3 block">Notes</label>
          <div className="flex gap-3">
            <StickyNote size={20} className="text-tertiary mt-1" />
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-transparent border-none p-0 font-body text-on-surface focus:ring-0 placeholder:text-outline-variant resize-none" 
              placeholder="What did you spend this on?" 
              rows={3}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold py-5 rounded-full shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <LoadingSpinner className="text-white" /> : <><Save size={20} /> {expenseId ? 'Update Entry' : 'Confirm Entry'}</>}
        </button>
      </form>
    </Layout>
  );
};

const Analytics = () => {
  const { user } = useContext(AuthContext);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'trips'), where('user_email', '==', user.email));
    return onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      setTrips(tripsData);
      if (tripsData.length > 0 && !selectedTrip) setSelectedTrip(tripsData[0]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trips');
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedTrip) return;
    const q = query(collection(db, `trips/${selectedTrip.id}/expenses`));
    return onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
  }, [selectedTrip]);

  if (loading) {
    return (
      <Layout title="Analytics">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size={48} />
          <p className="text-outline font-medium animate-pulse">Generating reports...</p>
        </div>
      </Layout>
    );
  }

  if (!selectedTrip) return <Layout title="Analytics"><div className="p-10 text-center">No trips found.</div></Layout>;

  const totalSpent = expenses.reduce((acc, e) => acc + e.amount_inr, 0);
  const totalBudget = Object.values(selectedTrip.budget).reduce((a: number, b: number) => a + b, 0) as number;

  const startDate = selectedTrip.trip_start_date?.toDate() || new Date();
  const endDate = selectedTrip.trip_end_date?.toDate() || new Date();
  const now = startOfDay(new Date());
  
  const totalTripDuration = Math.max(1, differenceInDays(startOfDay(endDate), startOfDay(startDate)) + 1);
  const daysElapsed = Math.min(totalTripDuration, Math.max(1, differenceInDays(now, startOfDay(startDate)) + 1));
  
  const calculateForecast = (category: string, categorySpent: number, categoryBudget: number) => {
    const dailyAvg = category === 'accommodation' 
      ? categorySpent / totalTripDuration 
      : categorySpent / daysElapsed;
      
    const forecasted = category === 'accommodation' 
      ? categorySpent 
      : dailyAvg * totalTripDuration;
    
    let status: 'green' | 'amber' | 'red' = 'green';
    if (forecasted > categoryBudget * 1.15) status = 'red';
    else if (forecasted > categoryBudget) status = 'amber';
    
    return { forecasted, dailyAvg, status };
  };

  return (
    <Layout title="Analytics & Reports">
      <section className="mb-10">
        <select 
          value={selectedTrip.id}
          onChange={e => setSelectedTrip(trips.find(t => t.id === e.target.value) || null)}
          className="w-full bg-surface-container-lowest p-4 rounded-xl shadow-sm border-none font-headline font-bold text-primary mb-6"
        >
          {trips.map(t => <option key={t.id} value={t.id}>{t.trip_name}</option>)}
        </select>

        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm relative overflow-hidden flex flex-col justify-between border-l-4 border-primary">
          <div className="flex justify-between items-start mb-6">
            <p className="font-label text-[10px] font-medium uppercase tracking-[0.05em] text-primary">Total Budget Status</p>
            <button 
              onClick={() => generateTripReport(selectedTrip, expenses)}
              className="flex items-center gap-2 text-primary font-bold text-xs bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
            >
              <FileText size={14} /> Export PDF
            </button>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-headline text-5xl font-extrabold tracking-tighter text-primary">₹{totalSpent.toLocaleString()}</span>
            <span className="font-label text-sm text-outline">Spent</span>
          </div>
          <div className="w-full bg-surface-container-high h-4 rounded-full overflow-hidden mt-4">
            <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full" style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }}></div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="font-headline font-bold text-xl mb-6 flex items-center gap-2">
          <BarChart3 size={24} className="text-primary" /> Spending Forecast
          <span className="text-[10px] font-label font-medium bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-wider ml-auto">
            Day {daysElapsed} of {totalTripDuration}
          </span>
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {CATEGORIES.map(cat => {
            const budget = selectedTrip.budget[cat.value] || 0;
            const spent = expenses.filter(e => e.category === cat.value).reduce((a, b) => a + b.amount_inr, 0);
            const { forecasted, dailyAvg, status } = calculateForecast(cat.value, spent, budget);
            
            const statusConfig = {
              red: { color: 'text-error', bg: 'bg-error/10', border: 'border-error', label: 'High Risk' },
              amber: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning', label: 'At Risk' },
              green: { color: 'text-success', bg: 'bg-success/10', border: 'border-success', label: 'On Track' }
            };
            const config = statusConfig[status];

            return (
              <div key={cat.value} className={`bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 ${config.border} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                <div className="flex items-center gap-4">
                  <div className={`${config.bg} p-3 rounded-full ${config.color}`}>
                    {cat.value === 'accommodation' && <Hotel size={20} />}
                    {cat.value === 'transport' && <Train size={20} />}
                    {cat.value === 'food_activities' && <Utensils size={20} />}
                    {cat.value === 'shopping' && <ShoppingBag size={20} />}
                    {cat.value === 'miscellaneous' && <MoreHorizontal size={20} />}
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-base">{cat.label}</h4>
                    <p className="text-[10px] font-label text-outline uppercase tracking-wider">Projected Total</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="font-headline font-bold text-xs text-outline">Daily Avg</p>
                    <p className="font-headline font-bold text-sm text-on-surface">₹{Math.round(dailyAvg).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-headline font-extrabold text-lg ${config.color}`}>₹{Math.round(forecasted).toLocaleString()}</p>
                    <div className="flex items-center gap-1 justify-end">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="font-headline font-bold text-xs text-outline">Budget</p>
                    <p className="font-headline font-bold text-sm text-on-surface">₹{budget.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {CATEGORIES.map(cat => {
          const budget = selectedTrip.budget[cat.value as keyof typeof selectedTrip.budget] || 0;
          const spent = expenses.filter(e => e.category === cat.value).reduce((a, b) => a + b.amount_inr, 0);
          const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
          
          const statusStyles = {
            error: {
              border: 'border-error',
              bg: 'bg-error/10',
              text: 'text-error',
              bar: 'bg-error'
            },
            warning: {
              border: 'border-warning',
              bg: 'bg-warning/10',
              text: 'text-warning',
              bar: 'bg-warning'
            },
            success: {
              border: 'border-success',
              bg: 'bg-success/10',
              text: 'text-success',
              bar: 'bg-success'
            }
          };

          let status: 'error' | 'warning' | 'success' = 'success';
          if (percent > 100) status = 'error';
          else if (percent > 85) status = 'warning';

          const style = statusStyles[status];

          return (
            <div key={cat.value} className={`bg-surface-container-lowest rounded-xl p-6 shadow-sm border-l-4 ${style.border}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`${style.bg} p-2 rounded-xl ${style.text}`}>
                  {cat.value === 'accommodation' && <Hotel size={24} />}
                  {cat.value === 'transport' && <Train size={24} />}
                  {cat.value === 'food_activities' && <Utensils size={24} />}
                  {cat.value === 'shopping' && <ShoppingBag size={24} />}
                  {cat.value === 'miscellaneous' && <MoreHorizontal size={24} />}
                </div>
                <span className={`font-label text-xs font-bold ${style.text}`}>{percent}%</span>
              </div>
              <h4 className="font-headline font-bold text-lg mb-4">{cat.label}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-on-surface-variant">Spent</span>
                  <span className={`font-bold ${style.text}`}>₹{spent.toLocaleString()}</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full">
                  <div className={`${style.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${budget > 0 ? Math.min(100, percent) : 0}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-medium text-outline pt-1">
                  <span>Budget: ₹{budget.toLocaleString()}</span>
                  {percent > 100 && <span className="text-error font-bold">Over Budget!</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

const Settings = () => {
  const { user, settings } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSource.trim()) return;
    if (settings.payment_sources.includes(newSource.trim())) {
      showToast('Source already exists', 'error');
      return;
    }

    setLoading(true);
    try {
      const updatedSources = [...settings.payment_sources, newSource.trim()];
      await setDoc(doc(db, 'user_settings', user.uid), {
        payment_sources: updatedSources
      });
      setNewSource('');
      showToast('Payment source added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_settings/${user.uid}`);
      showToast('Failed to add source', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSource = async (source: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedSources = settings.payment_sources.filter(s => s !== source);
      await setDoc(doc(db, 'user_settings', user.uid), {
        payment_sources: updatedSources
      });
      showToast('Payment source removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_settings/${user.uid}`);
      showToast('Failed to remove source', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Settings" showBack>
      <div className="space-y-8">
        <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border-l-4 border-primary">
          <h3 className="font-headline font-bold text-lg mb-6 flex items-center gap-2">
            <Wallet size={20} className="text-primary" /> Payment Sources
          </h3>
          
          <form onSubmit={handleAddSource} className="flex gap-2 mb-8">
            <input 
              required
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              className="flex-1 bg-surface-container rounded-full px-6 py-3 font-body text-sm focus:ring-2 focus:ring-primary/20 transition-all border-none"
              placeholder="e.g. Forex Card, Amex"
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-primary text-white p-3 rounded-full shadow-lg active:scale-90 transition-transform disabled:opacity-50"
            >
              <Plus size={20} />
            </button>
          </form>

          <div className="space-y-3">
            {settings.payment_sources.map(source => (
              <div key={source} className="flex justify-between items-center p-4 bg-surface-container rounded-xl group">
                <span className="font-body font-medium">{source}</span>
                <button 
                  onClick={() => handleRemoveSource(source)}
                  className="p-2 text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border-l-4 border-outline opacity-70">
          <h3 className="font-headline font-bold text-lg mb-2 flex items-center gap-2">
            <UserIcon size={20} className="text-outline" /> Account Info
          </h3>
          <p className="text-sm text-outline-variant">{user?.email}</p>
          <div className="mt-8">
            <button 
              onClick={() => signOut(auth)}
              className="px-6 py-2 rounded-full border border-error text-error font-bold text-sm hover:bg-error/5 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
};

const AppRoutes = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/new-trip" element={user ? <TripForm /> : <Navigate to="/login" />} />
      <Route path="/trip/:tripId" element={user ? <TripDetails /> : <Navigate to="/login" />} />
      <Route path="/trip/:tripId/edit" element={user ? <TripForm /> : <Navigate to="/login" />} />
      <Route path="/trip/:tripId/log" element={user ? <ExpenseForm /> : <Navigate to="/login" />} />
      <Route path="/trip/:tripId/expense/:expenseId/edit" element={user ? <ExpenseForm /> : <Navigate to="/login" />} />
      <Route path="/log" element={user ? <Dashboard /> : <Navigate to="/login" />} /> {/* Default to dashboard to pick a trip */}
      <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
