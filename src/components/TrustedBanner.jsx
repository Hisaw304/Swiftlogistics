// src/components/TrustedBanner.jsx
import React from "react";
import CountUp from "react-countup";
import { siVisa, siMastercard, siPaypal, siDiscover } from "simple-icons";

const TrustedBanner = () => {
  const icons = [
    { icon: siVisa, alt: "Visa" },
    { icon: siMastercard, alt: "Mastercard" },
    { icon: siPaypal, alt: "PayPal" },
    { icon: siDiscover, alt: "Discover" },
  ];

  return (
    <section className="bg-gray-50 py-16 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-sm uppercase text-green-600 font-medium tracking-widest mb-3">
          Trusted Worldwide
        </p>

        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
          Trusted by{" "}
          <span className="text-green-700">
            <CountUp end={10000} duration={3} separator="," />+
          </span>{" "}
          users and growing
        </h2>

        <p className="text-gray-600 max-w-2xl mx-auto mb-8">
          Swift Logistics is the preferred solution for thousands of customers
          and businesses around the world.
        </p>

        <div className="flex flex-wrap justify-center items-center gap-10 mt-6">
          {icons.map(({ icon, alt }, idx) => (
            <svg
              key={idx}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-10 w-10 text-green-600 opacity-80 hover:opacity-100 transition"
              aria-label={alt}
            >
              <path d={icon.path} />
            </svg>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedBanner;
