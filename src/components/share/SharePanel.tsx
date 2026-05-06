import { useState, useEffect, useCallback } from 'react';
import { Share2, Link, Plus, Trash2, Copy, Check, Eye, Clock, ChevronDown, ExternalLink, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ShareableLink, ShareableLinkInsert } from '../../lib/database.types';

interface SharePanelProps {
  athleteId: string;
  userId: string;
}

interface NewLinkState {
  label: string;
  includeNutrition: boolean;
  includeSessions: boolean;
  includeLab: boolean;
  expiryDays: string;
}

const DEFAULT_NEW: NewLinkState = {
  label: 'Coach View',
  includeNutrition: false,
  includeSessions: true,
  includeLab: false,
  expiryDays: '30',
};

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function daysUntilExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.ceil(diff / 86400000);
  return `${days}d remaining`;
}

export function SharePanel({ athleteId, userId }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareableLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newLink, setNewLink] = useState<NewLinkState>({ ...DEFAULT_NEW });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/athlete-api`;

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shareable_links')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false });
    if (!error && data) setLinks(data);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const createLink = async () => {
    setError(null);
    setCreating(true);
    try {
      const token = generateToken();
      let expiresAt: string | undefined;
      if (newLink.expiryDays && parseInt(newLink.expiryDays) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(newLink.expiryDays));
        expiresAt = d.toISOString();
      }

      const insert: ShareableLinkInsert = {
        athlete_id: athleteId,
        user_id: userId,
        token,
        label: newLink.label || 'Shared Report',
        expires_at: expiresAt,
        include_nutrition: newLink.includeNutrition,
        include_sessions: newLink.includeSessions,
        include_lab: newLink.includeLab,
      };

      const { error } = await supabase.from('shareable_links').insert(insert);
      if (error) throw error;
      setShowNew(false);
      setNewLink({ ...DEFAULT_NEW });
      await fetchLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (id: string) => {
    await supabase.from('shareable_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const copyUrl = async (link: ShareableLink) => {
    const url = `${apiBase}/share/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggle = (field: keyof Pick<NewLinkState, 'includeNutrition' | 'includeSessions' | 'includeLab'>) => {
    setNewLink(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 font-body font-medium text-[12px] px-3 py-2 rounded-xl transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        {links.length > 0 && (
          <span className="text-[9px] font-bold bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">
            {links.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-[380px] bg-white border border-gray-200 rounded-[16px] shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-heading text-[13px]" style={{ color: '#514163' }}>Shareable API Links</p>
                <p className="font-body text-[10px] text-gray-400 mt-0.5">Read-only JSON access for coaches & tools</p>
              </div>
              <button
                onClick={() => { setShowNew(true); setError(null); }}
                className="btn-primary flex items-center gap-1 text-[11px] px-2.5 py-1.5"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>

            {showNew && (
              <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-heading text-[11px] uppercase tracking-wider" style={{ color: '#514163' }}>New Share Link</p>
                  <button onClick={() => setShowNew(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block font-body text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Label</label>
                  <input
                    type="text"
                    value={newLink.label}
                    onChange={e => setNewLink(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. Coach View – March 2026"
                    className="w-full asc-input text-[12px]"
                  />
                </div>

                <div>
                  <label className="block font-body text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Expiry (days, 0 = never)</label>
                  <input
                    type="number"
                    value={newLink.expiryDays}
                    onChange={e => setNewLink(prev => ({ ...prev, expiryDays: e.target.value }))}
                    min="0"
                    max="365"
                    className="w-full asc-input text-[12px]"
                  />
                </div>

                <div>
                  <label className="block font-body text-[10px] uppercase tracking-wider text-gray-400 mb-2">Include Data</label>
                  <div className="space-y-2">
                    {[
                      { field: 'includeSessions' as const, label: 'Sessions & Impulse History' },
                      { field: 'includeNutrition' as const, label: 'Nutrition Logs' },
                      { field: 'includeLab' as const, label: 'Lab Test Results' },
                    ].map(({ field, label }) => (
                      <label key={field} className="flex items-center gap-2.5 cursor-pointer group">
                        <div
                          onClick={() => toggle(field)}
                          className="w-8 h-4 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
                          style={{ backgroundColor: newLink[field] ? '#fdda36' : '#e5e7eb' }}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${newLink[field] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="font-body text-[11px] text-gray-500 group-hover:text-gray-700 transition-colors">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="font-body text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-2.5 py-1.5">{error}</p>
                )}

                <button
                  onClick={createLink}
                  disabled={creating}
                  className="w-full btn-primary disabled:opacity-50 text-[12px] py-2"
                >
                  {creating ? 'Creating...' : 'Generate Link'}
                </button>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
                </div>
              ) : links.length === 0 ? (
                <div className="py-8 text-center">
                  <Link className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="font-body text-[12px] text-gray-400">No share links yet</p>
                  <p className="font-body text-[10px] text-gray-300 mt-1">Create a link to share read-only access</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {links.map(link => {
                    const expired = isExpired(link.expires_at);
                    const apiUrl = `${apiBase}/share/${link.token}`;
                    return (
                      <div
                        key={link.id}
                        className={`rounded-xl border p-3 ${expired ? 'border-red-100 bg-red-50 opacity-60' : 'border-gray-100 bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-body text-[12px] font-semibold text-gray-700 truncate">{link.label}</p>
                            <p className="font-body text-[10px] text-gray-400 truncate mt-0.5">{link.token}</p>
                          </div>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          {[
                            link.include_sessions && 'Sessions',
                            link.include_nutrition && 'Nutrition',
                            link.include_lab && 'Lab',
                          ].filter(Boolean).map(tag => (
                            <span key={tag as string} className="font-body text-[9px] uppercase tracking-wider bg-sky-50 text-sky-500 border border-sky-100 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                          <span className={`font-body text-[9px] ${expired ? 'text-red-400' : 'text-gray-400'}`}>
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {daysUntilExpiry(link.expires_at)}
                          </span>
                          <span className="font-body text-[9px] text-gray-300 ml-auto">
                            <Eye className="w-2.5 h-2.5 inline mr-0.5" />
                            {link.view_count} views
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1">
                            <p className="font-body text-[9px] text-gray-400 truncate">{apiUrl}</p>
                          </div>
                          <button
                            onClick={() => copyUrl(link)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-[10px] text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                          >
                            {copiedId === link.id ? (
                              <><Check className="w-3 h-3 text-green-500" /> Copied</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy</>
                            )}
                          </button>
                          <a
                            href={apiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {link.last_viewed_at && (
                          <p className="font-body text-[9px] text-gray-300 mt-1.5">
                            Last accessed {formatDate(link.last_viewed_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="font-body text-[9px] text-gray-400">
                API endpoint: <span className="text-gray-500">{apiBase}/share/&#123;token&#125;</span>
              </p>
              <p className="font-body text-[9px] text-gray-300 mt-0.5">
                Sub-routes: /sessions · /nutrition · /lab
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
