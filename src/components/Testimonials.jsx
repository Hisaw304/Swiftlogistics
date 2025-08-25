// src/components/Testimonials.jsx
import React from "react";
import { Quote } from "lucide-react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

const testimonials = [
  {
    name: "Jane Doe",
    role: "E‑commerce Store Owner",
    text: "Swift Logistics has transformed how we deliver products. Reliable, fast, and hassle‑free.",
  },
  {
    name: "Mark Johnson",
    role: "Regular Customer",
    text: "I can track every parcel in real time. Absolutely love the service.",
  },
  {
    name: "Olivia Brown",
    role: "Business Manager",
    text: "Their speed and communication are unmatched. Never missed a delivery.",
  },
];

const Testimonials = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          What Our Clients Say
        </h2>

        <Swiper
          modules={[Autoplay]}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          loop={true}
          spaceBetween={30}
          slidesPerView={1}
        >
          {testimonials.map((t, idx) => (
            <SwiperSlide key={idx}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-gray-100 p-8 rounded-lg shadow-md max-w-xl mx-auto"
              >
                <Quote className="mx-auto mb-4 text-blue-600 w-8 h-8" />
                <p className="text-gray-700 italic mb-4">"{t.text}"</p>
                <h4 className="text-gray-800 font-semibold">{t.name}</h4>
                <p className="text-gray-500 text-sm">{t.role}</p>
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default Testimonials;
