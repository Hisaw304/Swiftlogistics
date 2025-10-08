import React, { useEffect, useState } from "react";
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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (adminKey) loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  function saveAdminKey(key) {
    try {
      localStorage.setItem("adminKey", key);
    } catch {}
    setAdminKey(key);
  }

  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchRecords({ limit: 200 });
      setRecords(Array.isArray(json.items) ? json.items : json.items || []);
    } catch (err) {
      setError(err.message || "Failed to load records.");
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

    // get normalized id strings for comparison
    const updatedIdStr =
      updated._id && updated._id.toString
        ? updated._id.toString()
        : String(updated._id);
    const updatedTrackingId = updated.trackingId;

    setRecords((s) =>
      s.map((r) => {
        const rIdStr =
          r._id && r._id.toString ? r._id.toString() : String(r._id);
        return rIdStr === updatedIdStr || r.trackingId === updatedTrackingId
          ? updated
          : r;
      })
    );

    setEditing(null);
    return updated;
  }
  async function deleteRecordById(id) {
    if (!confirm("Delete this record?")) return;

    const idStr = id && id.toString ? id.toString() : String(id);

    try {
      const res = await fetch(
        `/api/admin/records/${encodeURIComponent(idStr)}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": adminKey },
        }
      );

      if (!res.ok) {
        // try to show server error
        let body = null;
        try {
          body = await res.json();
        } catch (e) {
          body = await res.text().catch(() => null);
        }
        throw new Error(body?.error || body || `HTTP ${res.status}`);
      }

      // only remove from UI after success
      setRecords((s) =>
        s.filter(
          (rr) =>
            (rr._id && rr._id.toString ? rr._id.toString() : String(rr._id)) !==
              idStr && rr.trackingId !== idStr
        )
      );

      // If you're using a cache/revalidate layer (SWR/react-query), revalidate here:
      // mutate('/api/admin/records'); // uncomment if using SWR
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err.message || "unknown"));
      // optional: re-fetch records to resync UI
      // await refetchRecords();
    }
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
      alert(err.message || "Failed to advance.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Admin Panel — Tracking Records
      </h1>

      {/* Admin key section */}
      <div className="mb-6">
        <label className="text-sm text-gray-600 font-medium">
          Type your Admin Key below
        </label>
        <div className="flex gap-2 mt-2">
          <input
            className="p-2 border rounded flex-1"
            placeholder="Enter your ADMIN_KEY"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => saveAdminKey(adminKey)}
          >
            Save
          </button>
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
            onClick={() => {
              localStorage.removeItem("adminKey");
              setAdminKey("");
              setRecords([]);
            }}
          >
            Clear
          </button>
          <button
            className="px-4 py-2 bg-gray-100 rounded text-sm"
            onClick={loadRecords}
            disabled={!adminKey}
          >
            Refresh
          </button>
        </div>
        {!adminKey && (
          <p className="text-xs text-red-600 mt-2">
            ⚠️ Please enter your admin key to access records.
          </p>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">
            Create a New Record
          </h2>
          <AdminForm onCreate={handleCreate} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700">All Records</h2>
            <button
              className="px-4 py-2 bg-gray-100 rounded text-sm"
              onClick={loadRecords}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500 text-center">
              Loading records…
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>
          ) : (
            <RecordsTable
              records={records}
              onNext={handleNext}
              onEdit={(r) => setEditing(r)}
              onView={(r) => setViewing(r)}
              onDelete={deleteRecordById}
            />
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewing && (
        <TrackingModal record={viewing} onClose={() => setViewing(null)} />
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">
                Edit Record — {editing.trackingId}
              </h3>
              <button
                className="text-sm text-gray-600"
                onClick={() => setEditing(null)}
              >
                ✕ Close
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
