import React, { useRef, useEffect, useMemo } from 'react';

interface VariableProximityProps {
  label: string;
  className?: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  radius?: number;
  falloff?: 'linear' | 'exponential' | 'gaussian';
  containerRef?: React.RefObject<HTMLElement>;
}

const VariableProximity = ({
  label,
  className = '',
  fromFontVariationSettings,
  toFontVariationSettings,
  radius = 100,
  falloff = 'linear',
  containerRef,
}: VariableProximityProps) => {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const interpolatedSettingsRef = useRef<string[]>([]);

  // Parse settings string into a map of axis -> value
  // Example: "'wght' 400, 'opsz' 9" -> { wght: 400, opsz: 9 }
  const parseSettings = (settings: string): Record<string, number> => {
    return settings.split(',').reduce((acc, part) => {
      const [axis, value] = part.trim().split(' ');
      if (axis && value) {
        acc[axis.replace(/['"]/g, '')] = parseFloat(value);
      }
      return acc;
    }, {} as Record<string, number>);
  };

  const fromSettings = useMemo(() => parseSettings(fromFontVariationSettings), [fromFontVariationSettings]);
  const toSettings = useMemo(() => parseSettings(toFontVariationSettings), [toFontVariationSettings]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      letterRefs.current.forEach((letter, index) => {
        if (!letter) return;

        const letterRect = letter.getBoundingClientRect();
        // Calculate center relative to container
        const letterX = letterRect.left - rect.left + letterRect.width / 2;
        const letterY = letterRect.top - rect.top + letterRect.height / 2;

        const dist = Math.sqrt(
          Math.pow(mouseX - letterX, 2) + Math.pow(mouseY - letterY, 2)
        );

        let factor = 0;
        if (dist < radius) {
          if (falloff === 'linear') {
            factor = 1 - dist / radius;
          } else if (falloff === 'exponential') {
            factor = Math.pow(1 - dist / radius, 2);
          } else if (falloff === 'gaussian') {
            // Simplified gaussian-ish
            factor = Math.exp(-Math.pow(dist / (radius / 2), 2));
          }
        }

        // Interpolate between from and to settings
        const currentSettings = Object.keys(fromSettings).map((axis) => {
          const fromValue = fromSettings[axis];
          const toValue = toSettings[axis] || fromValue;
          const value = fromValue + (toValue - fromValue) * factor;
          return `'${axis}' ${value}`;
        }).join(', ');

        letter.style.fontVariationSettings = currentSettings;
      });
    };

    const handleMouseLeave = () => {
       // Reset to start
       letterRefs.current.forEach((letter) => {
         if (!letter) return;
         letter.style.fontVariationSettings = fromFontVariationSettings;
       });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    // Initialize
    letterRefs.current.forEach((letter) => {
        if (!letter) return;
        letter.style.fontVariationSettings = fromFontVariationSettings;
    });

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, fromSettings, toSettings, radius, falloff, fromFontVariationSettings]);

  return (
    <span className={`${className} inline-block`}>
      {label.split('').map((char, index) => (
        <span
          key={index}
          ref={(el) => {
            letterRefs.current[index] = el;
          }}
          style={{ 
            display: 'inline-block', 
            transition: 'font-variation-settings 0.1s ease',
            whiteSpace: char === ' ' ? 'pre' : 'normal'
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};

export default VariableProximity;
