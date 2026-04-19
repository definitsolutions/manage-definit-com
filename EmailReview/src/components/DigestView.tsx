'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DigestContent } from '@/types';

interface Props {
  digest: DigestContent | null;
  onGenerate: () => Promise<void>;
}

function urgencyColor(u: string): string {
  switch (u) {
    case 'critical': return 'border-red-400 bg-red-50';
    case 'high': return 'border-orange-400 bg-orange-50';
    case 'medium': return 'border-yellow-400 bg-yellow-50';
    case 'low': return 'border-gray-300 bg-gray-50';
    default: return 'border-gray-300 bg-gray-50';
  }
}

export default function DigestView({ digest, onGenerate }: Props) {
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Executive Digest</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating...' : 'Generate New Digest'}
        </button>
      </div>

      {!digest && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No digest generated yet. Click &quot;Generate New Digest&quot; to create one.
        </div>
      )}

      {digest && (
        <>
          {/* Stats bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
              <StatBox label="Needs Reply" value={digest.stats.needsReply} />
              <StatBox label="Waiting" value={digest.stats.waitingOnTeam} />
              <StatBox label="Stale" value={digest.stats.staleThreads} />
              <StatBox label="Promises" value={digest.stats.promisesMade} />
              <StatBox label="VIP" value={digest.stats.vipHighPriority} />
              <StatBox label="Total" value={digest.stats.totalFlagged} />
            </div>
          </div>

          {/* Digest items */}
          <div className="space-y-3">
            {digest.items.map((item, i) => (
              <div
                key={item.threadId}
                className={`border-l-4 rounded-lg bg-white border border-gray-200 p-4 ${urgencyColor(item.urgency)}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                    <span className={`text-xs font-medium uppercase px-1.5 py-0.5 rounded ${
                      item.urgency === 'critical' ? 'bg-red-200 text-red-800' :
                      item.urgency === 'high' ? 'bg-orange-200 text-orange-800' :
                      item.urgency === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {item.urgency}
                    </span>
                    {item.companyName && (
                      <span className="text-xs text-blue-700 font-medium">{item.companyName}</span>
                    )}
                  </div>
                  {item.hoursSinceLastClient !== null && (
                    <span className="text-xs text-gray-400">{item.hoursSinceLastClient}h ago</span>
                  )}
                </div>

                <Link
                  href={`/thread/${item.threadId}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-700"
                >
                  {item.subject}
                </Link>

                <p className="text-sm text-gray-600 mt-1">{item.summary}</p>

                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Why flagged:</span> {item.reasonFlagged}
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Recommended:</span> {item.recommendedAction}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Generated {new Date(digest.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
