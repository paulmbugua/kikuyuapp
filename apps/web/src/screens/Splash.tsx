import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
const doveLogo = '/dove-logo.png';

const Splash = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-card flex flex-col items-center justify-center z-50">
      <div className={`transition-all duration-1000 ease-out ${show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-90'}`}>
        <img
          src={doveLogo}
          alt="Thutha"
          className="w-28 h-28 animate-dove-float"
        />
      </div>
      <p
        className={`mt-6 text-lg font-heading font-semibold text-primary tracking-wide transition-all duration-1000 delay-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        Voice of Agĩkũyũ
      </p>
      <h1
        className={`mt-2 text-3xl font-heading font-bold text-foreground tracking-tight transition-all duration-1000 delay-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        Thutha
      </h1>
    </div>
  );
};

export default Splash;
