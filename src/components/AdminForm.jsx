import React, { useState, useEffect } from "react";
import ImageUploader from "./ImageUploader";

/*
  Props:
    - onCreate(payload)
    - onUpdate(id, payload)
    - initial (optional)
    - mode: "create" | "edit"
    - onCancel (optional)
*/

function hasAnyAddressField(addr) {
  return !!(addr && (addr.full || addr.city || addr.zip));
}

export default function AdminForm({
  onCreate,
  onUpdate,
  initial = null,
  mode = "create",
  onCancel,
}) {
  const [customerName, setCustomerName] = useState(initial?.customerName || "");
  const [addressFull, setAddressFull] = useState(initial?.address?.full || "");
  const [city, setCity] = useState(initial?.address?.city || "");
  const [zip, setZip] = useState(initial?.address?.zip || "");
  const [product, setProduct] = useState(initial?.product || "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [originWarehouse, setOriginWarehouse] = useState(
    initial?.originWarehouse || "Los Angeles, CA"
  );
  const [destination, setDestination] = useState(initial?.destination || "");
  const [status, setStatus] = useState(initial?.status || "Pending");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initial) {
      setCustomerName(initial.customerName || "");
      setAddressFull(initial.address?.full || "");
      setCity(initial.address?.city || "");
      setZip(initial.address?.zip || "");
      setProduct(initial.product || "");
      setQuantity(initial.quantity ?? 1);
      setOriginWarehouse(initial.originWarehouse || "Los Angeles, CA");
      setDestination(initial.destination || "");
      setStatus(initial.status || "Pending");
      setImageUrl(initial.imageUrl || null);
    }
  }, [initial]);

  // safe stringify id helper
  function safeIdFromInitial(init) {
    if (!init) return null;
    if (init.trackingId) return String(init.trackingId);
    if (init._id) return String(init._id);
    if (init.id) return String(init.id);
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Build payload minimally (don't include undefined fields)
      const payload = {};
      if (customerName) payload.customerName = customerName;
      if (hasAnyAddressField({ full: addressFull, city, zip })) {
        const addr = {};
        if (addressFull) addr.full = addressFull;
        if (city) addr.city = city;
        if (zip) addr.zip = zip;
        payload.address = addr;
      }
      if (product) payload.product = product;
      if (quantity !== undefined && quantity !== null)
        payload.quantity = Number(quantity);
      if (originWarehouse) payload.originWarehouse = originWarehouse;
      if (imageUrl) payload.imageUrl = imageUrl;
      if (status) payload.status = status;
      if (destination) payload.destination = destination;

      if (mode === "create") {
        await onCreate(payload);
      } else if (mode === "edit" && onUpdate && initial) {
        // robust id: prefer trackingId, fall back to _id or id
        const idToSend = safeIdFromInitial(initial);

        // Debug: log what we will send (remove in production)
        console.log("AdminForm: update call:", { idToSend, payload, initial });

        if (!idToSend) {
          throw new Error(
            "Missing record id: trackingId or _id required for update"
          );
        }

        // Call parent's onUpdate with a clean id string
        await onUpdate(idToSend, payload);
      }
    } catch (err) {
      console.error("❌ Save failed (AdminForm):", err);
      setError(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="p-2 border rounded"
          placeholder="Customer / Recipient Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
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
          placeholder="Street address (full)"
          value={addressFull}
          onChange={(e) => setAddressFull(e.target.value)}
        />

        <div className="flex gap-3 md:col-span-2">
          <input
            className="p-2 border rounded flex-1"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="p-2 border rounded w-32"
            placeholder="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Record" : "Save"}
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
