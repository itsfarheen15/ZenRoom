"use client";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Developer Zen Room contributors

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const COLORS = ["#c9e6ff", "#a8a0ed", "#8ed7cd"];
const scatter = (seed) => fraction(Math.sin(seed * 73.13 + 11.7) * 10937.3);
const fraction = (value) => value - Math.floor(value);

export function LightTunnel({ paused = false, className = "" }) {
    const canvasRef = useRef(null);
    const timeRef = useRef(0);
    const driftRef = useRef({ x: 0, y: 0 });
    const reducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        let width = 0;
        let height = 0;
        let frame = 0;
        let previousTime = 0;
        const pointer = { x: driftRef.current.x, y: driftRef.current.y };
        const moving = !paused && !reducedMotion;
        const clouds = document.createElement("canvas");
        const stars = Array.from({ length: 260 }, (_, index) => ({
            x: scatter(index + 1), y: scatter(index + 421),
            radius: 0.35 + scatter(index + 73) * 1.05,
            phase: scatter(index + 123) * Math.PI * 2,
            layer: 0.3 + scatter(index + 781) * 0.7,
        }));
        const meteors = Array.from({ length: 9 }, (_, index) => ({
            x: scatter(index + 62), phase: index / 9,
            speed: 0.045 + scatter(index + 992) * 0.024,
            length: 70 + scatter(index + 418) * 95,
            color: COLORS[index % COLORS.length],
        }));

        function paintClouds() {
            clouds.width = Math.max(1, Math.round(width / 2));
            clouds.height = Math.max(1, Math.round(height / 2));
            const sky = clouds.getContext("2d");
            if (!sky) return;
            sky.scale(0.5, 0.5);
            for (const [x, y, radius, color] of [
                [0.72, 0.18, 0.55, "94, 67, 154"],
                [0.3, 0.5, 0.46, "28, 102, 116"],
                [0.86, 0.68, 0.35, "68, 54, 118"],
            ]) {
                const glow = sky.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * radius);
                glow.addColorStop(0, `rgba(${color}, 0.19)`);
                glow.addColorStop(0.45, `rgba(${color}, 0.07)`);
                glow.addColorStop(1, `rgba(${color}, 0)`);
                sky.fillStyle = glow;
                sky.fillRect(0, 0, width, height);
            }
        }

        function draw() {
            const drift = driftRef.current;
            context.clearRect(0, 0, width, height);
            context.globalAlpha = 1;
            context.drawImage(clouds, -12 + drift.x, -12 + drift.y, width + 24, height + 24);
            const count = width < 640 ? 130 : stars.length;
            for (const star of stars.slice(0, count)) {
                // Slow, low-amplitude shimmer keeps the star field restful.
                const shimmer = 0.78 + Math.sin(timeRef.current * 0.35 + star.phase) * 0.12;
                const x = star.x * width + drift.x * star.layer;
                const y = star.y * height + drift.y * star.layer;
                context.globalAlpha = shimmer * (0.25 + star.layer * 0.38);
                context.fillStyle = "#d3e1fb";
                context.beginPath();
                context.arc(x, y, star.radius, 0, Math.PI * 2);
                context.fill();
                if (star.radius > 1.25) {
                    context.globalAlpha *= 0.1;
                    context.beginPath();
                    context.arc(x, y, star.radius * 3, 0, Math.PI * 2);
                    context.fill();
                }
            }
            context.lineCap = "round";
            for (const meteor of meteors.slice(0, width < 640 ? 5 : 9)) {
                const depth = fraction(meteor.phase + timeRef.current * meteor.speed);
                const x = meteor.x * (width + height * 0.32) + 60 - depth * (height + 360) * 0.32;
                const y = -180 + depth * (height + 360);
                const length = meteor.length * Math.min(1, width / 700);
                const tailX = x + length * 0.32;
                const tailY = y - length;
                const fade = Math.min(1, depth * 7, (1 - depth) * 7);
                const trail = context.createLinearGradient(tailX, tailY, x, y);
                trail.addColorStop(0, `${meteor.color}00`);
                trail.addColorStop(0.8, `${meteor.color}66`);
                trail.addColorStop(1, meteor.color);
                context.beginPath();
                context.moveTo(tailX, tailY);
                context.lineTo(x, y);
                context.strokeStyle = trail;
                context.globalAlpha = fade * 0.07;
                context.lineWidth = 5;
                context.stroke();
                context.globalAlpha = fade * 0.65;
                context.lineWidth = 0.85;
                context.stroke();
                context.fillStyle = "#e8f0ff";
                context.beginPath();
                context.arc(x, y, 1.1, 0, Math.PI * 2);
                context.fill();
            }
            context.globalAlpha = 1;
        }

        function tick(now) {
            if (!previousTime) previousTime = now;
            const elapsed = now - previousTime;
            if (elapsed >= 1000 / 30) {
                timeRef.current += Math.min(elapsed, 80) / 1000;
                previousTime = now;
                const easing = 1 - Math.exp(-Math.min(elapsed, 80) / 650);
                driftRef.current.x += (pointer.x - driftRef.current.x) * easing;
                driftRef.current.y += (pointer.y - driftRef.current.y) * easing;
                draw();
            }
            frame = requestAnimationFrame(tick);
        }
        function syncAnimation() {
            cancelAnimationFrame(frame);
            previousTime = 0;
            if (moving && !document.hidden) frame = requestAnimationFrame(tick);
        }
        function resize() {
            const bounds = canvas.getBoundingClientRect();
            width = bounds.width;
            height = bounds.height;
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            paintClouds();
            draw();
        }
        function move(event) {
            if (event.pointerType === "touch") return;
            const bounds = canvas.getBoundingClientRect();
            pointer.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(width, 1) * 2 - 1)) * 8;
            pointer.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(height, 1) * 2 - 1)) * 6;
        }
        function leave() { pointer.x = 0; pointer.y = 0; }
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();
        syncAnimation();
        document.addEventListener("visibilitychange", syncAnimation);
        if (moving) {
            window.addEventListener("pointermove", move, { passive: true });
            document.documentElement.addEventListener("pointerleave", leave);
            window.addEventListener("blur", leave);
        }
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener("visibilitychange", syncAnimation);
            window.removeEventListener("pointermove", move);
            document.documentElement.removeEventListener("pointerleave", leave);
            window.removeEventListener("blur", leave);
        };
    }, [paused, reducedMotion]);

    return <canvas ref={canvasRef} className={`light-tunnel ${className}`} aria-hidden="true" />;
}
