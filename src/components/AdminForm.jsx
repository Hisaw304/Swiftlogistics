// src/components/AdminForm.jsx
import React, { useState, useEffect } from "react";
import ImageUploader from "./ImageUploader";

/*
  Props:
    - onCreate(payload)    // called to create new record
    - onUpdate(id, payload) // optional for edit mode
    - initial (optional) object for edit mode (full doc)
    - mode: "create" | "edit"
*/

export default function AdminForm({
  onCreate,
  onUpdate,
  initial = null,
  mode = "create",
  onCancel,
}) {
  const [customerName, setCustomerName] = useState(initial?.customerName || "");
  const [address, setAddress] = useState(initial?.address?.full || "");
  const [product, setProduct] = useState(initial?.product || "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [originWarehouse, setOriginWarehouse] = useState(
    initial?.originWarehouse || "Los Angeles, CA"
  );
  const [destination, setDestination] = useState(
    initial?.route?.slice(-1)[0]?.city || ""
  );
  const [initialStatus, setInitialStatus] = useState(
    initial?.status || "Pending"
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initial) {
      setCustomerName(initial.customerName || "");
      setAddress(initial.address?.full || "");
      setProduct(initial.product || "");
      setQuantity(initial.quantity ?? 1);
      setOriginWarehouse(initial.originWarehouse || "Los Angeles, CA");
      setDestination(initial.route?.slice(-1)[0]?.city || "");
      setInitialStatus(initial.status || "Pending");
      setImageUrl(initial.imageUrl || null);
    }
  }, [initial]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        customerName: customerName || undefined,
        address: { full: address || undefined },
        product,
        quantity,
        originWarehouse,
        destination,
        imageUrl,
        initialStatus,
      };
      if (mode === "create") {
        const created = await onCreate(payload);
        // parent will handle state update
      } else if (mode === "edit" && onUpdate && initial) {
        await onUpdate(initial._id || initial.trackingId, {
          customerName,
          address: { full: address },
          product,
          quantity,
          originWarehouse,
          imageUrl,
          status: initialStatus,
        });
      }
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="p-2 border rounded"
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <input
          className="p-2 border rounded"
          placeholder="Product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          required
        />
        <input
          className="p-2 border rounded"
          placeholder="Quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <select
          className="p-2 border rounded"
          value={originWarehouse}
          onChange={(e) => setOriginWarehouse(e.target.value)}
        >
          <option>Los Angeles, CA</option>
          <option>Chicago, IL</option>
          <option>New York, NY</option>
          <option>Dallas, TX</option>
        </select>
        <input
          className="p-2 border rounded md:col-span-2"
          placeholder="Destination (City, ST)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
        <input
          className="p-2 border rounded md:col-span-2"
          placeholder="Address (optional / full)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image (upload)</label>
        <ImageUploader
          initialUrl={imageUrl}
          onUploadComplete={(u) => setImageUrl(u)}
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={initialStatus}
          onChange={(e) => setInitialStatus(e.target.value)}
          className="p-2 border rounded text-sm"
        >
          <option>Pending</option>
          <option>On Hold</option>
          <option>Shipped</option>
          <option>Out for Delivery</option>
          <option>Delivered</option>
          <option>Exception</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? "Saving..." : mode === "create" ? "Create Record" : "Save"}
        </button>

        {mode === "edit" && (
          <button
            type="button"
            className="px-3 py-2 bg-gray-100 rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
    </form>
  );
}
