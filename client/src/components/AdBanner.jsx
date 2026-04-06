import { useEffect, useState } from 'react';

const ZERADS_SRC = {
    '728x90':  'https://zerads.com/ad/ad.php?width=728&ref=10776',
    '468x60':  'https://zerads.com/ad/ad.php?width=468&ref=10776',
    '300x250': 'https://zerads.com/ad/ad.php?width=300&ref=10776',
};

const ZERADS_SIZE = {
    '728x90':  { width: 728,  height: 90  },
    '468x60':  { width: 468,  height: 60  },
    '300x250': { width: 300,  height: 250 },
};

export default function AdBanner({ size = '728x90', forceProvider = null }) {
    const [provider, setProvider] = useState('zerads');

    const { width, height } = ZERADS_SIZE[size] || ZERADS_SIZE['728x90'];

    useEffect(() => {
        if (forceProvider) { setProvider(forceProvider); return; }
        // 30% Silvio, 70% ZerAds
        setProvider(Math.random() < 0.3 ? 'silvio' : 'zerads');
    }, [size, forceProvider]);

    if (provider === 'silvio') {
        return (
            <div className="flex flex-col items-center justify-center gap-2 my-12 animate-in fade-in duration-1000 w-full overflow-hidden">
                <div
                    className="relative bg-slate-900/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                    style={{ width, height, maxWidth: '100%' }}
                >
                    <a href="https://www.youtube.com/watch?v=QaRzOr7HPDs" target="_blank" rel="noopener noreferrer" className="block w-full h-full group">
                        <img
                            src="/Silvio/Banner (2).jpg"
                            alt="Advertisement"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] italic mt-2">⇑ Patrocinado ⇑</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-2 my-12 animate-in fade-in duration-1000 w-full overflow-hidden">
            <iframe
                src={ZERADS_SRC[size] || ZERADS_SRC['728x90']}
                width={width}
                height={height}
                marginWidth={0}
                marginHeight={0}
                scrolling="no"
                frameBorder={0}
                style={{ border: 'none', maxWidth: '100%', display: 'block' }}
                title={`ZerAds ${size}`}
            />
        </div>
    );
}

