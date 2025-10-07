// src/pages/AdminPage.jsx
import React, { useEffect, useState, useRef } from "react";
import AdminForm from "../components/AdminForm";
import RecordsTable from "../components/RecordsTable";
import TrackingModal from "../components/TrackingModal";
import { fetchRecords, createRecord, updateRecord, nextStop } from "../lib/api";

export default function AdminPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem("adminKey") || "";
    } catch {
      return "";
    }
  });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const demoRef = useRef(null);
  const [intervalSec, setIntervalSec] = useState(10);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveAdminKey(key) {
    try {
      localStorage.setItem("adminKey", key);
    } catch {}
    setAdminKey(key);
    loadRecords();
  }

  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchRecords({ limit: 200 });
      setRecords(Array.isArray(json.items) ? json.items : json.items || []);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload) {
    const created = await createRecord(payload);
    setRecords((s) => [created, ...s]);
    return created;
  }

  async function handleUpdate(idOrTrackingId, payload) {
    const updated = await updateRecord(idOrTrackingId, payload);
    setRecords((s) =>
      s.map((r) =>
        r._id === updated._id || r.trackingId === updated.trackingId
          ? updated
          : r
      )
    );
    setEditing(null);
    return updated;
  }

  async function handleNext(idOrTrackingId) {
    try {
      const updated = await nextStop(idOrTrackingId);
      setRecords((s) =>
        s.map((r) =>
          r._id === updated._id || r.trackingId === updated.trackingId
            ? updated
            : r
        )
      );
      return updated;
    } catch (err) {
      alert(err.message || "Failed to advance");
    }
  }

  function startDemo() {
    if (demoRef.current) clearInterval(demoRef.current);
    demoRef.current = setInterval(async () => {
      for (const r of records) {
        if (!r.route || r.currentIndex >= r.route.length - 1) continue;
        try {
          const updated = await nextStop(r._id || r.trackingId);
          setRecords((s) =>
            s.map((rr) =>
              rr._id === updated._id || rr.trackingId === updated.trackingId
                ? updated
                : rr
            )
          );
        } catch (e) {
          console.warn("demo next error", e);
        }
      }
    }, Math.max(1000, intervalSec * 1000));
    setDemoRunning(true);
  }
  function stopDemo() {
    if (demoRef.current) {
      clearInterval(demoRef.current);
      demoRef.current = null;
    }
    setDemoRunning(false);
  }

  useEffect(() => {
    return () => {
      if (demoRef.current) clearInterval(demoRef.current);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Admin — Tracking Records</h1>

      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Admin Key (stored locally)
        </label>
        <div className="flex gap-2 mt-1">
          <input
            className="p-2 border rounded flex-1"
            placeholder="Paste ADMIN_KEY here"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded"
            onClick={() => saveAdminKey(adminKey)}
          >
            Save
          </button>
          <button
            className="px-3 py-2 bg-gray-100 rounded"
            onClick={() => {
              localStorage.removeItem("adminKey");
              setAdminKey("");
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Admin endpoints require x-admin-key header. For quick testing you can
          also add ?adminKey= in URL but this UI uses localStorage header.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-2">Create record</h2>
          <AdminForm onCreate={handleCreate} />
          <div className="mt-4 text-xs text-gray-500">
            Image upload uses Cloudinary unsigned preset (VITE_CLOUDINARY_* env
            vars or paste at upload UI).
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Records</h2>
              <div className="text-xs text-gray-500">
                Showing latest — Last updated sorts server-side.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-20 p-2 border rounded text-sm"
                value={intervalSec}
                onChange={(e) =>
                  setIntervalSec(Math.max(1, Number(e.target.value || 10)))
                }
              />
              {!demoRunning ? (
                <button
                  className="px-3 py-2 bg-green-600 text-white rounded"
                  onClick={startDemo}
                >
                  Start Demo
                </button>
              ) : (
                <button
                  className="px-3 py-2 bg-red-500 text-white rounded"
                  onClick={stopDemo}
                >
                  Stop Demo
                </button>
              )}
              <button
                className="px-3 py-2 bg-gray-100 rounded text-sm"
                onClick={loadRecords}
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">Loading records…</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>
          ) : (
            <RecordsTable
              records={records}
              onNext={handleNext}
              onEdit={(r) => setEditing(r)}
              onView={(r) => setViewing(r)}
              onDelete={async (id) => {
                if (!confirm("Delete this record?")) return;
                try {
                  await fetch(`/api/admin/records/${encodeURIComponent(id)}`, {
                    method: "DELETE",
                    headers: { "x-admin-key": adminKey },
                  });
                  setRecords((s) =>
                    s.filter((rr) => rr._id !== id && rr.trackingId !== id)
                  );
                } catch (e) {
                  alert("Delete failed");
                }
              }}
            />
          )}
        </div>
      </div>

      {/* View modal */}
      {viewing && (
        <TrackingModal record={viewing} onClose={() => setViewing(null)} />
      )}

      {/* Edit modal / panel */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="w-full max-w-2xl bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Edit record — {editing.trackingId}
              </h3>
              <button
                className="text-sm text-gray-600"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
            <AdminForm
              mode="edit"
              initial={editing}
              onUpdate={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
