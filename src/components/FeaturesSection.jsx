// src/components/FeaturesSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Package, RefreshCcw, Clock, AlertCircle, Truck } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Drop off a package",
    desc: "Easily drop your parcels at any of our locations.",
  },
  {
    icon: RefreshCcw,
    title: "Redirect a package",
    desc: "Change the delivery location hassle-free.",
  },
  {
    icon: Clock,
    title: "Store hours & services",
    desc: "Find nearby centers and service availability.",
  },
  {
    icon: AlertCircle,
    title: "Service alerts",
    desc: "Stay updated on shipping delays or issues.",
  },
  {
    icon: Truck,
    title: "Return a package",
    desc: "Seamless returns with tracking support.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      type: "spring",
      stiffness: 120,
    },
  }),
};

const FeaturesSection = () => {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-center">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={idx}
              className="flex flex-col items-center p-6 bg-white rounded-xl shadow hover:shadow-lg transition"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }} // triggers when 30% visible
              custom={idx}
            >
              {/* Icon with pop + hover bounce */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{
                  delay: idx * 0.2,
                  type: "spring",
                  stiffness: 200,
                }}
                className="mb-4"
              >
                <Icon size={32} className="text-green-600" />
              </motion.div>

              {/* Title + description */}
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturesSection;
