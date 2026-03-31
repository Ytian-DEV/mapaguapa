import type { SVGProps } from "react";

type HouseMarkProps = SVGProps<SVGSVGElement>;

export default function HouseMark({ className, ...props }: HouseMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4.75 12.25L14 4.5L23.25 12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M7.25 10.85V22.1C7.25 22.6523 7.69772 23.1 8.25 23.1H19.75C20.3023 23.1 20.75 22.6523 20.75 22.1V10.85"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M11.1 23.1V15.75H16.9V23.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}