// src/components/WhyShipWithUs.jsx
import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const benefits = [
  "Fast and reliable delivery",
  "Real-time tracking updates",
  "Affordable shipping rates",
  "24/7 customer support",
  "Global reach with local expertise",
];

const WhyShipWithUs = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex justify-center"
        >
          <img
            src="/shipping.jpg" // Replace with your trucking image
            alt="Why Ship With Us"
            className="rounded-2xl shadow-lg w-full max-w-md lg:max-w-lg object-cover h-80"
          />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Why Ship With Us?
          </h2>
          <p className="text-gray-600 mb-6">
            We go the extra mile to ensure your shipments arrive safely,
            quickly, and at the best rates. Here’s why businesses and
            individuals trust us every day:
          </p>

          <ul className="space-y-4">
            {benefits.map((benefit, idx) => (
              <motion.li
                key={idx}
                className="flex items-center text-gray-700"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <CheckCircle
                  className="text-green-600 mr-3 flex-shrink-0"
                  size={22}
                />
                {benefit}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default WhyShipWithUs;
