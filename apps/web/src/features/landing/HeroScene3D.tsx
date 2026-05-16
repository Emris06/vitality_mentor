import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { BankIllustration } from '../../components/ui/IllustrationGreeting';

/**
 * 3D hero scene — Direction A: Floating Credential Card.
 *
 * A stylized enterprise credential card slowly orbits the Y axis, surrounded
 * by three small satellite "skill credentials" that drift around it. The
 * aesthetic is deliberately quiet: no shader effects, no harsh shadows, no
 * user interaction — it reads as a banking artifact, not a tech demo.
 *
 * Hard fallbacks (return the inline SVG instead of <Canvas/>) when:
 *   - prefers-reduced-motion is set
 *   - viewport width is < 768px
 *   - the browser fails to give us a WebGL context (defensive)
 */
export default function HeroScene3D() {
  const [shouldRender3D, setShouldRender3D] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluate = () => {
      const wide = window.innerWidth >= 768;
      const ok = wide && !reducedMotion.matches;
      setShouldRender3D(ok);
    };

    evaluate();
    window.addEventListener('resize', evaluate);
    reducedMotion.addEventListener?.('change', evaluate);

    return () => {
      window.removeEventListener('resize', evaluate);
      reducedMotion.removeEventListener?.('change', evaluate);
    };
  }, []);

  if (!shouldRender3D) {
    return (
      <div className="flex items-center justify-center">
        <BankIllustration />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none relative aspect-square w-full md:aspect-[4/3]"
      style={{
        background:
          'radial-gradient(60% 55% at 50% 45%, rgba(45,107,254,0.10) 0%, rgba(45,107,254,0) 70%)',
      }}
      aria-hidden="true"
    >
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.2, 5], fov: 35 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[-3, 4, 4]} intensity={0.85} color="#ffffff" />
        <directionalLight position={[3, -2, 2]} intensity={0.2} color="#B4CAFE" />

        <CredentialCard />
        <Satellite position={[2.1, 0.9, 0.4]} color="#7C3AED" shape="cube" delay={0} />
        <Satellite position={[-2.2, -0.6, 0.6]} color="#14B8A6" shape="torus" delay={0.6} />
        <Satellite position={[1.6, -1.1, -0.3]} color="#10B981" shape="sphere" delay={1.2} />
      </Canvas>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Credential card                                                            */
/* -------------------------------------------------------------------------- */

function CredentialCard() {
  const groupRef = useRef<any>(null);

  // Slow auto-orbit on Y axis — ~5 RPM = ~0.105 rad/s. Add a tiny floating Y
  // bob so the card feels suspended in air rather than mechanically rotating.
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += delta * 0.18;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.06;
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.04;
  });

  // Field rows on the card front, expressed as relative y-positions so the
  // geometry stays self-contained.
  const fieldRows = useMemo(
    () => [
      { y: 0.05, width: 1.2 },
      { y: -0.15, width: 0.9 },
      { y: -0.35, width: 1.05 },
      { y: -0.55, width: 0.6 },
    ],
    [],
  );

  return (
    <group ref={groupRef} rotation={[-0.05, 0.4, 0]}>
      {/* Card body — slightly thicker than a plane so the edge highlight reads */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.65, 0.06]} />
        <meshStandardMaterial color="#2D6BFE" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Front face overlay — slightly inset, with a subtler gradient via vertex colors */}
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[2.56, 1.61]} />
        <meshStandardMaterial color="#1E4FCC" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Brand mark "A" — a simple white plate, kept abstract */}
      <mesh position={[-1.05, 0.5, 0.04]}>
        <planeGeometry args={[0.36, 0.36]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[-1.05, 0.5, 0.041]}>
        <planeGeometry args={[0.18, 0.04]} />
        <meshStandardMaterial color="#2D6BFE" />
      </mesh>
      <mesh position={[-1.05, 0.44, 0.041]}>
        <planeGeometry args={[0.22, 0.04]} />
        <meshStandardMaterial color="#2D6BFE" />
      </mesh>

      {/* Faint horizontal field lines — abstract stand-ins for ID rows */}
      {fieldRows.map((row, i) => (
        <mesh key={i} position={[-0.35 + row.width / 2 - 0.85, row.y, 0.04]}>
          <planeGeometry args={[row.width, 0.045]} />
          <meshStandardMaterial color="#85A8FD" transparent opacity={0.55} />
        </mesh>
      ))}

      {/* Chip-like accent square (top right) */}
      <mesh position={[0.95, 0.45, 0.04]}>
        <planeGeometry args={[0.32, 0.24]} />
        <meshStandardMaterial color="#D9E5FF" roughness={0.4} />
      </mesh>
      <mesh position={[0.95, 0.45, 0.041]}>
        <planeGeometry args={[0.22, 0.02]} />
        <meshStandardMaterial color="#5A85FB" />
      </mesh>
      <mesh position={[0.95, 0.42, 0.041]}>
        <planeGeometry args={[0.22, 0.02]} />
        <meshStandardMaterial color="#5A85FB" />
      </mesh>

      {/* Edge highlight strip — gives the card a premium beveled feel */}
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[2.6, 0.02, 0.065]} />
        <meshStandardMaterial color="#B4CAFE" roughness={0.3} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Satellite credentials                                                      */
/* -------------------------------------------------------------------------- */

interface SatelliteProps {
  position: [number, number, number];
  color: string;
  shape: 'cube' | 'torus' | 'sphere';
  delay: number;
}

function Satellite({ position, color, shape, delay }: SatelliteProps) {
  const meshRef = useRef<any>(null);

  useFrame((state, dt) => {
    const m = meshRef.current;
    if (!m) return;
    m.rotation.x += dt * 0.4;
    m.rotation.y += dt * 0.6;
    // A subtle slow orbit around the parent origin
    const t = state.clock.elapsedTime * 0.18 + delay;
    m.position.x = position[0] + Math.cos(t) * 0.12;
    m.position.z = position[2] + Math.sin(t) * 0.12;
  });

  return (
    <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.6} floatingRange={[-0.12, 0.12]}>
      <mesh ref={meshRef} position={position}>
        {shape === 'cube' && <boxGeometry args={[0.32, 0.32, 0.32]} />}
        {shape === 'torus' && <torusGeometry args={[0.2, 0.06, 16, 48]} />}
        {shape === 'sphere' && <sphereGeometry args={[0.22, 24, 24]} />}
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
    </Float>
  );
}
