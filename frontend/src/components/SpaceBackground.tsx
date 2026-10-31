export default function SpaceBackground() {
  return (
    <div className="space-bg" aria-hidden="true">
      <div className="space-layer space-stars-far" />

      <svg className="space-constellations" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        {/* Constelação 1 */}
        <g className="constellation" style={{ animationDelay: '0s' }}>
          <polyline points="180,120 240,180 200,260 280,300 340,240" />
          <circle cx="180" cy="120" r="3" /><circle cx="240" cy="180" r="4" /><circle cx="200" cy="260" r="3" /><circle cx="280" cy="300" r="3.5" /><circle cx="340" cy="240" r="3" />
        </g>
        {/* Constelação 2 */}
        <g className="constellation" style={{ animationDelay: '2s' }}>
          <polyline points="1620,180 1680,140 1740,200 1700,280 1650,320 1600,260 1620,180" />
          <circle cx="1620" cy="180" r="3.5" /><circle cx="1680" cy="140" r="3" /><circle cx="1740" cy="200" r="4" /><circle cx="1700" cy="280" r="3" /><circle cx="1650" cy="320" r="3" /><circle cx="1600" cy="260" r="3.5" />
        </g>
        {/* Constelação 3 */}
        <g className="constellation" style={{ animationDelay: '4s' }}>
          <polyline points="900,800 960,760 1020,800 1080,760 1120,820 1060,860 1000,840 960,880 900,800" />
          <circle cx="900" cy="800" r="3" /><circle cx="960" cy="760" r="4" /><circle cx="1020" cy="800" r="3" /><circle cx="1080" cy="760" r="3.5" /><circle cx="1120" cy="820" r="3" /><circle cx="1060" cy="860" r="4" /><circle cx="1000" cy="840" r="3" /><circle cx="960" cy="880" r="3" />
        </g>
        {/* Constelação 4 */}
        <g className="constellation" style={{ animationDelay: '1.5s' }}>
          <polyline points="260,880 380,920 340,1000 260,880" />
          <circle cx="260" cy="880" r="3.5" /><circle cx="380" cy="920" r="3" /><circle cx="340" cy="1000" r="4" />
        </g>
        {/* Constelação 5 */}
        <g className="constellation" style={{ animationDelay: '3s' }}>
          <polyline points="1300,80 1360,120 1320,180 1380,220" />
          <circle cx="1300" cy="80" r="3" /><circle cx="1360" cy="120" r="4" /><circle cx="1320" cy="180" r="3" /><circle cx="1380" cy="220" r="3.5" />
        </g>
        {/* Constelação 6 - Nova no canto inferior direito */}
        <g className="constellation" style={{ animationDelay: '5s' }}>
          <polyline points="1500,900 1580,850 1640,920 1600,1000 1520,980 1500,900" />
          <circle cx="1500" cy="900" r="3" /><circle cx="1580" cy="850" r="4" /><circle cx="1640" cy="920" r="3.5" /><circle cx="1600" cy="1000" r="3" /><circle cx="1520" cy="980" r="4" />
        </g>
        {/* Constelação 7 - Nova no meio esquerdo */}
        <g className="constellation" style={{ animationDelay: '1s' }}>
          <polyline points="80,400 160,380 180,480 100,520 80,400" />
          <circle cx="80" cy="400" r="4" /><circle cx="160" cy="380" r="3" /><circle cx="180" cy="480" r="3.5" /><circle cx="100" cy="520" r="3" />
        </g>
        {/* Constelação 8 - Nova topo centro */}
        <g className="constellation" style={{ animationDelay: '2.5s' }}>
          <polyline points="800,60 880,100 840,180 920,160 960,80" />
          <circle cx="800" cy="60" r="3" /><circle cx="880" cy="100" r="4" /><circle cx="840" cy="180" r="3" /><circle cx="920" cy="160" r="3.5" /><circle cx="960" cy="80" r="3" />
        </g>
        {/* Constelação 9 - Nova meio direita */}
        <g className="constellation" style={{ animationDelay: '6s' }}>
          <polyline points="1750,600 1820,560 1880,620 1840,700 1750,600" />
          <circle cx="1750" cy="600" r="3.5" /><circle cx="1820" cy="560" r="4" /><circle cx="1880" cy="620" r="3" /><circle cx="1840" cy="700" r="3" />
        </g>
        {/* Constelação 10 - Nova baixo centro */}
        <g className="constellation" style={{ animationDelay: '3.5s' }}>
          <polyline points="600,950 700,900 780,960 720,1040" />
          <circle cx="600" cy="950" r="3" /><circle cx="700" cy="900" r="4" /><circle cx="780" cy="960" r="3" /><circle cx="720" cy="1040" r="3.5" />
        </g>
      </svg>

      <div className="space-meteors">
        {/* Aumentamos para 14 meteoros para ficar mais fluido e frequente */}
        <span className="meteor" style={{ top: '10%', left: '20%', animationDelay: '0s', animationDuration: '6s' }} />
        <span className="meteor" style={{ top: '5%', left: '60%', animationDelay: '2s', animationDuration: '7s' }} />
        <span className="meteor" style={{ top: '25%', left: '80%', animationDelay: '4s', animationDuration: '5s' }} />
        <span className="meteor" style={{ top: '40%', left: '10%', animationDelay: '1s', animationDuration: '8s' }} />
        <span className="meteor" style={{ top: '15%', left: '40%', animationDelay: '5s', animationDuration: '6s' }} />
        <span className="meteor" style={{ top: '55%', left: '70%', animationDelay: '3s', animationDuration: '7s' }} />
        <span className="meteor" style={{ top: '30%', left: '5%', animationDelay: '7s', animationDuration: '5s' }} />
        <span className="meteor" style={{ top: '8%', left: '85%', animationDelay: '1.5s', animationDuration: '6s' }} />
        <span className="meteor" style={{ top: '70%', left: '30%', animationDelay: '6s', animationDuration: '8s' }} />
        <span className="meteor" style={{ top: '20%', left: '50%', animationDelay: '8s', animationDuration: '5s' }} />
        <span className="meteor" style={{ top: '60%', left: '90%', animationDelay: '2.5s', animationDuration: '7s' }} />
        <span className="meteor" style={{ top: '80%', left: '15%', animationDelay: '4.5s', animationDuration: '6s' }} />
        <span className="meteor" style={{ top: '45%', left: '45%', animationDelay: '9s', animationDuration: '5s' }} />
        <span className="meteor" style={{ top: '5%', left: '25%', animationDelay: '10s', animationDuration: '7s' }} />
      </div>

      <div className="space-layer space-stars-near" />
      <div className="space-moon" />
    </div>
  )
}
