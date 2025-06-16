// src/components/ui/Logo.tsx
'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  /** Size variant for different use cases */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes for styling */
  className?: string;
  /** Whether to show the tagline */
  showTagline?: boolean;
  /** Whether to animate on hover */
  animated?: boolean;
}

/**
 * EchoFi Logo Component
 * 
 * A scalable SVG logo that represents the core concepts of our platform:
 * - Sound waves (Echo): Representing communication and reverberation of ideas
 * - Financial growth (Fi): Showing upward investment progression
 * - Network connectivity: Decentralized group coordination
 * 
 * The component is designed to work across different contexts while maintaining
 * visual consistency and professional appearance.
 */
export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  className = '',
  showTagline = true,
  animated = false
}) => {
  // Define size mappings for consistent scaling
  const dimensions = {
    sm: { width: 200, height: 67, fontSize: 18, taglineSize: 6 },   // Small - for headers, mobile
    md: { width: 300, height: 100, fontSize: 28, taglineSize: 9 },  // Medium - default size
    lg: { width: 400, height: 133, fontSize: 37, taglineSize: 12 }, // Large - for hero sections
    xl: { width: 500, height: 167, fontSize: 47, taglineSize: 15 }  // Extra large - for splash screens
  };

  const { width, height, fontSize, taglineSize } = dimensions[size];

  return (
    <div 
      className={cn(
        "inline-flex items-center justify-center",
        animated && "transition-transform duration-300 hover:scale-105",
        className
      )}
      role="img"
      aria-label="EchoFi - Decentralized Investment Coordination Platform"
    >
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 300 100" 
        xmlns="http://www.w3.org/2000/svg"
        className="select-none"
      >
        <defs>
          {/* Brand gradient - represents the journey from messaging to investment success */}
          <linearGradient id={`brandGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{stopColor: '#1E40AF', stopOpacity: 1}} />
            <stop offset="50%" style={{stopColor: '#3B82F6', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#10B981', stopOpacity: 1}} />
          </linearGradient>
          
          {/* Wave gradient - for the echo visualization */}
          <linearGradient id={`waveGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{stopColor: '#3B82F6', stopOpacity: 0.3}} />
            <stop offset="100%" style={{stopColor: '#10B981', stopOpacity: 0.6}} />
          </linearGradient>
          
          {/* Glow effect for modern tech aesthetic */}
          <filter id={`glow-${size}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background with subtle rounded corners for modern appearance */}
        <rect width="300" height="100" fill="#FAFAFA" rx="8" className="opacity-0"/>
        
        {/* Echo wave pattern - core visual metaphor for our messaging platform */}
        <g opacity="0.6">
          {/* Primary wave - represents main communication flow */}
          <path 
            d="M20 50 Q40 30, 60 50 T100 50" 
            stroke={`url(#waveGradient-${size})`} 
            strokeWidth="2" 
            fill="none"
            className={animated ? "animate-pulse" : ""}
          />
          {/* Secondary wave - represents echo/amplification effect */}
          <path 
            d="M25 50 Q40 38, 55 50 T85 50" 
            stroke={`url(#waveGradient-${size})`} 
            strokeWidth="1.5" 
            fill="none" 
            opacity="0.8"
          />
          {/* Tertiary wave - subtle reinforcement of the echo concept */}
          <path 
            d="M30 50 Q40 44, 50 50 T70 50" 
            stroke={`url(#waveGradient-${size})`} 
            strokeWidth="1" 
            fill="none" 
            opacity="0.6"
          />
        </g>
        
        {/* Financial growth visualization - subtle but important for the Fi concept */}
        <g opacity="0.4">
          <rect x="110" y="45" width="3" height="10" fill="#10B981" rx="1"/>
          <rect x="115" y="40" width="3" height="15" fill="#10B981" rx="1"/>
          <rect x="120" y="35" width="3" height="20" fill="#10B981" rx="1"/>
          <rect x="125" y="30" width="3" height="25" fill="#10B981" rx="1"/>
        </g>
        
        {/* Main wordmark - "Echo" with emphasis, "Fi" more subtle */}
        <text 
          x="140" 
          y="45" 
          fontFamily="Inter, system-ui, sans-serif" 
          fontSize={fontSize} 
          fontWeight="700" 
          fill={`url(#brandGradient-${size})`} 
          filter={`url(#glow-${size})`}
        >
          Echo
        </text>
        <text 
          x="220" 
          y="45" 
          fontFamily="Inter, system-ui, sans-serif" 
          fontSize={fontSize} 
          fontWeight="300" 
          fill="#1E40AF"
        >
          Fi
        </text>
        
        {/* Tagline - explains our value proposition clearly */}
        {showTagline && (
          <text 
            x="140" 
            y="62" 
            fontFamily="Inter, system-ui, sans-serif" 
            fontSize={taglineSize} 
            fontWeight="400" 
            fill="#6B7280" 
            letterSpacing="0.5px"
          >
            DECENTRALIZED INVESTMENT COORDINATION
          </text>
        )}
        
        {/* Network visualization - represents our decentralized architecture */}
        <circle cx="260" cy="25" r="2" fill="#3B82F6" opacity="0.8"/>
        <circle cx="270" cy="30" r="1.5" fill="#10B981" opacity="0.6"/>
        <circle cx="275" cy="20" r="1" fill="#1E40AF" opacity="0.9"/>
        
        {/* Connection lines - showing how network participants interact */}
        <line x1="260" y1="25" x2="270" y2="30" stroke="#3B82F6" strokeWidth="0.5" opacity="0.5"/>
        <line x1="270" y1="30" x2="275" y2="20" stroke="#10B981" strokeWidth="0.5" opacity="0.5"/>
        
        {/* Echo indicator - reinforces the "echo" concept near the wordmark */}
        <circle cx="135" cy="35" r="3" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.4"/>
        <circle cx="135" cy="35" r="6" fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.3"/>
        <circle cx="135" cy="35" r="9" fill="none" stroke="#3B82F6" strokeWidth="0.3" opacity="0.2"/>
      </svg>
    </div>
  );
};