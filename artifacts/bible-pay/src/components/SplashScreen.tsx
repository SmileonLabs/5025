import { motion } from "framer-motion";

/**
 * In-app splash / intro screen.
 *
 * Rendered by the React app itself (not the OS), so it always reflects the
 * latest logo after a deploy — no reinstall needed. The matching static markup
 * in index.html (#app-splash) shows the same frame instantly before JS loads,
 * making the hand-off to this component seamless.
 */
export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white"
    >
      <motion.img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="5025"
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="w-52 max-w-[70%]"
      />
    </motion.div>
  );
}
