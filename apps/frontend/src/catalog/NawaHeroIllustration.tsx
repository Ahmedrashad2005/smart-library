export function NawaHeroIllustration(): JSX.Element {
  return (
    <svg
      className="nawa-hero__illustration"
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hero-navy-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#173f78" />
          <stop offset="1" stopColor="#0b2448" />
        </linearGradient>
        <linearGradient id="hero-coral-cover" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ef7c79" />
          <stop offset="1" stopColor="#c84f55" />
        </linearGradient>
        <linearGradient id="hero-vase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.58" stopColor="#eef1f2" />
          <stop offset="1" stopColor="#c8d0d4" />
        </linearGradient>
        <filter id="hero-object-shadow" x="-30%" y="-25%" width="170%" height="175%">
          <feDropShadow dx="8" dy="10" stdDeviation="8" floodColor="#102f5e" floodOpacity="0.18" />
        </filter>
        <filter id="hero-contact-shadow" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <circle cx="92" cy="82" r="116" fill="#dfeaf5" opacity="0.72" />
      <circle cx="510" cy="88" r="72" fill="#fff9f4" opacity="0.9" />
      <path
        d="M28 214C132 136 213 245 324 174S509 139 618 202"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        opacity="0.8"
      />
      <path
        d="M6 239C115 174 218 263 329 196S520 160 640 219"
        fill="none"
        stroke="#9dbada"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <g className="hero-illustration__dots" fill="#ffffff" opacity="0.72">
        <circle cx="71" cy="112" r="3" />
        <circle cx="89" cy="112" r="3" />
        <circle cx="107" cy="112" r="3" />
        <circle cx="80" cy="130" r="3" />
        <circle cx="98" cy="130" r="3" />
        <circle cx="116" cy="130" r="3" />
      </g>

      <ellipse
        cx="337"
        cy="326"
        rx="270"
        ry="15"
        fill="#102f5e"
        opacity="0.13"
        filter="url(#hero-contact-shadow)"
      />

      <g className="hero-illustration__plant" filter="url(#hero-object-shadow)">
        <path d="M124 240C127 174 116 116 151 58" fill="none" stroke="#61734d" strokeWidth="5" />
        <path d="M135 178C109 153 84 143 57 143" fill="none" stroke="#61734d" strokeWidth="3" />
        <path d="M135 141C159 116 177 98 199 87" fill="none" stroke="#61734d" strokeWidth="3" />
        <path d="M145 104C126 84 113 72 92 64" fill="none" stroke="#61734d" strokeWidth="3" />
        <path d="M151 70C169 54 182 45 200 42" fill="none" stroke="#61734d" strokeWidth="3" />
        <path d="M58 143C77 124 102 128 115 149C94 162 74 159 58 143Z" fill="#9fac6b" />
        <path d="M84 111C101 93 124 95 137 113C120 128 99 127 84 111Z" fill="#6f8658" />
        <path d="M92 64C110 52 128 58 136 78C117 87 101 81 92 64Z" fill="#aab574" />
        <path d="M199 87C187 65 164 63 149 80C161 99 181 101 199 87Z" fill="#7f925a" />
        <path d="M200 42C187 28 169 31 158 48C171 61 189 58 200 42Z" fill="#b6bd7b" />
        <path
          d="M77 228C77 212 90 202 106 202H150C166 202 179 212 179 228L171 309C170 321 160 330 148 330H108C96 330 86 321 85 309L77 228Z"
          fill="url(#hero-vase)"
          stroke="#d5dade"
          strokeWidth="2"
        />
        <path
          d="M91 227C100 237 156 237 166 227"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          opacity="0.8"
        />
        <path
          d="M104 252C119 243 138 244 153 254"
          fill="none"
          stroke="#b7c0c4"
          strokeWidth="2"
          opacity="0.7"
        />
      </g>

      <g className="hero-illustration__books" filter="url(#hero-object-shadow)">
        <g>
          <path
            d="M214 122H279V330H214C207 330 202 325 202 318V134C202 127 207 122 214 122Z"
            fill="#edf3f7"
          />
          <path
            d="M213 123H224V330H213C207 330 202 325 202 319V134C202 128 207 123 213 123Z"
            fill="#cbdbe8"
          />
          <path d="M237 151H265M237 158H258" stroke="#102f5e" strokeWidth="2" opacity="0.46" />
          <path d="M242 283H266" stroke="#d9a441" strokeWidth="3" />
        </g>

        <g>
          <path
            d="M281 86H337V330H281C274 330 269 325 269 318V98C269 91 274 86 281 86Z"
            fill="#d9a441"
          />
          <path
            d="M281 87H291V330H281C274 330 269 325 269 318V99C269 92 274 87 281 87Z"
            fill="#b9851d"
          />
          <path d="M302 111V299" stroke="#fff9f4" strokeWidth="1.5" opacity="0.55" />
          <text
            x="315"
            y="238"
            fill="#fff9f4"
            fontSize="15"
            fontWeight="700"
            textAnchor="middle"
            transform="rotate(-90 315 238)"
          >
            رحلة معرفة
          </text>
        </g>

        <g>
          <path
            d="M342 57H476C484 57 490 63 490 71V330H342C334 330 328 324 328 316V71C328 63 334 57 342 57Z"
            fill="url(#hero-navy-cover)"
          />
          <path
            d="M342 58H358V330H342C334 330 328 324 328 316V72C328 64 334 58 342 58Z"
            fill="#092141"
          />
          <path d="M375 82H460M375 91H438" stroke="#d9a441" strokeWidth="2" opacity="0.68" />
          <path
            d="M395 142C414 126 438 126 457 142V209C438 196 414 196 395 209V142Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            opacity="0.85"
          />
          <path d="M426 132V201" stroke="#ffffff" strokeWidth="2" opacity="0.85" />
          <circle cx="426" cy="116" r="5" fill="#e86a6a" />
          <text x="426" y="250" fill="#ffffff" fontSize="20" fontWeight="700" textAnchor="middle">
            عالم نَوَى
          </text>
          <text x="426" y="275" fill="#d9e4ef" fontSize="9" letterSpacing="3" textAnchor="middle">
            KNOWLEDGE
          </text>
          <path d="M375 300H460" stroke="#d9a441" strokeWidth="2" opacity="0.75" />
        </g>

        <g transform="rotate(-4 532 330)">
          <path
            d="M499 101H562C570 101 576 107 576 115V330H499C491 330 485 324 485 316V115C485 107 491 101 499 101Z"
            fill="url(#hero-coral-cover)"
          />
          <path
            d="M499 102H511V330H499C491 330 485 324 485 316V116C485 108 491 102 499 102Z"
            fill="#ad4249"
          />
          <path d="M524 128H557M524 136H551" stroke="#fff9f4" strokeWidth="2" opacity="0.65" />
          <text
            x="539"
            y="252"
            fill="#fff9f4"
            fontSize="15"
            fontWeight="700"
            textAnchor="middle"
            transform="rotate(-90 539 252)"
          >
            اكتشف وتعلّم
          </text>
          <circle cx="541" cy="290" r="12" fill="none" stroke="#d9a441" strokeWidth="2" />
          <circle cx="541" cy="290" r="3" fill="#d9a441" />
        </g>
      </g>

      <path
        d="M16 330H624V346C624 353 618 359 611 359H29C22 359 16 353 16 346V330Z"
        fill="#a8734f"
      />
      <path d="M16 330H624V337H16Z" fill="#c9966c" />
      <path d="M42 348H598" stroke="#85573a" strokeWidth="2" opacity="0.45" />
    </svg>
  );
}
