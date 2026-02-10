import { useState, useEffect } from 'react';

const useMobile = () => {
  // 768px è il breakpoint 'md' di Tailwind. Sotto è mobile.
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    
    // Pulizia dell'event listener quando il componente viene smontato
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

export default useMobile;