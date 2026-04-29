import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface Country {
  code: string;
  name: string;
  dialCode: string;
}

const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", dialCode: "+93" },
  { code: "AL", name: "Albania", dialCode: "+355" },
  { code: "DZ", name: "Algeria", dialCode: "+213" },
  { code: "AD", name: "Andorra", dialCode: "+376" },
  { code: "AO", name: "Angola", dialCode: "+244" },
  { code: "AG", name: "Antigua and Barbuda", dialCode: "+1268" },
  { code: "AR", name: "Argentina", dialCode: "+54" },
  { code: "AM", name: "Armenia", dialCode: "+374" },
  { code: "AW", name: "Aruba", dialCode: "+297" },
  { code: "AC", name: "Ascension Island", dialCode: "+247" },
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "AT", name: "Austria", dialCode: "+43" },
  { code: "AZ", name: "Azerbaijan", dialCode: "+994" },
  { code: "BS", name: "Bahamas", dialCode: "+1242" },
  { code: "BH", name: "Bahrain", dialCode: "+973" },
  { code: "BD", name: "Bangladesh", dialCode: "+880" },
  { code: "BB", name: "Barbados", dialCode: "+1246" },
  { code: "BY", name: "Belarus", dialCode: "+375" },
  { code: "BE", name: "Belgium", dialCode: "+32" },
  { code: "BZ", name: "Belize", dialCode: "+501" },
  { code: "BJ", name: "Benin", dialCode: "+229" },
  { code: "BT", name: "Bhutan", dialCode: "+975" },
  { code: "BO", name: "Bolivia", dialCode: "+591" },
  { code: "BA", name: "Bosnia and Herzegovina", dialCode: "+387" },
  { code: "BW", name: "Botswana", dialCode: "+267" },
  { code: "BR", name: "Brazil", dialCode: "+55" },
  { code: "BN", name: "Brunei", dialCode: "+673" },
  { code: "BG", name: "Bulgaria", dialCode: "+359" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226" },
  { code: "BI", name: "Burundi", dialCode: "+257" },
  { code: "KH", name: "Cambodia", dialCode: "+855" },
  { code: "CM", name: "Cameroon", dialCode: "+237" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "CV", name: "Cape Verde", dialCode: "+238" },
  { code: "CF", name: "Central African Republic", dialCode: "+236" },
  { code: "TD", name: "Chad", dialCode: "+235" },
  { code: "CL", name: "Chile", dialCode: "+56" },
  { code: "CN", name: "China", dialCode: "+86" },
  { code: "CO", name: "Colombia", dialCode: "+57" },
  { code: "KM", name: "Comoros", dialCode: "+269" },
  { code: "CG", name: "Congo", dialCode: "+242" },
  { code: "CD", name: "Congo (DRC)", dialCode: "+243" },
  { code: "CR", name: "Costa Rica", dialCode: "+506" },
  { code: "HR", name: "Croatia", dialCode: "+385" },
  { code: "CU", name: "Cuba", dialCode: "+53" },
  { code: "CY", name: "Cyprus", dialCode: "+357" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420" },
  { code: "DK", name: "Denmark", dialCode: "+45" },
  { code: "DJ", name: "Djibouti", dialCode: "+253" },
  { code: "DM", name: "Dominica", dialCode: "+1767" },
  { code: "DO", name: "Dominican Republic", dialCode: "+1809" },
  { code: "EC", name: "Ecuador", dialCode: "+593" },
  { code: "EG", name: "Egypt", dialCode: "+20" },
  { code: "SV", name: "El Salvador", dialCode: "+503" },
  { code: "GQ", name: "Equatorial Guinea", dialCode: "+240" },
  { code: "ER", name: "Eritrea", dialCode: "+291" },
  { code: "EE", name: "Estonia", dialCode: "+372" },
  { code: "ET", name: "Ethiopia", dialCode: "+251" },
  { code: "FJ", name: "Fiji", dialCode: "+679" },
  { code: "FI", name: "Finland", dialCode: "+358" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "GA", name: "Gabon", dialCode: "+241" },
  { code: "GM", name: "Gambia", dialCode: "+220" },
  { code: "GE", name: "Georgia", dialCode: "+995" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "GH", name: "Ghana", dialCode: "+233" },
  { code: "GR", name: "Greece", dialCode: "+30" },
  { code: "GD", name: "Grenada", dialCode: "+1473" },
  { code: "GT", name: "Guatemala", dialCode: "+502" },
  { code: "GN", name: "Guinea", dialCode: "+224" },
  { code: "GW", name: "Guinea-Bissau", dialCode: "+245" },
  { code: "GY", name: "Guyana", dialCode: "+592" },
  { code: "HT", name: "Haiti", dialCode: "+509" },
  { code: "HN", name: "Honduras", dialCode: "+504" },
  { code: "HK", name: "Hong Kong", dialCode: "+852" },
  { code: "HU", name: "Hungary", dialCode: "+36" },
  { code: "IS", name: "Iceland", dialCode: "+354" },
  { code: "IN", name: "India", dialCode: "+91" },
  { code: "ID", name: "Indonesia", dialCode: "+62" },
  { code: "IR", name: "Iran", dialCode: "+98" },
  { code: "IQ", name: "Iraq", dialCode: "+964" },
  { code: "IE", name: "Ireland", dialCode: "+353" },
  { code: "IL", name: "Israel", dialCode: "+972" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "JM", name: "Jamaica", dialCode: "+1876" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "JO", name: "Jordan", dialCode: "+962" },
  { code: "KZ", name: "Kazakhstan", dialCode: "+7" },
  { code: "KE", name: "Kenya", dialCode: "+254" },
  { code: "KI", name: "Kiribati", dialCode: "+686" },
  { code: "KW", name: "Kuwait", dialCode: "+965" },
  { code: "KG", name: "Kyrgyzstan", dialCode: "+996" },
  { code: "LA", name: "Laos", dialCode: "+856" },
  { code: "LV", name: "Latvia", dialCode: "+371" },
  { code: "LB", name: "Lebanon", dialCode: "+961" },
  { code: "LS", name: "Lesotho", dialCode: "+266" },
  { code: "LR", name: "Liberia", dialCode: "+231" },
  { code: "LY", name: "Libya", dialCode: "+218" },
  { code: "LI", name: "Liechtenstein", dialCode: "+423" },
  { code: "LT", name: "Lithuania", dialCode: "+370" },
  { code: "LU", name: "Luxembourg", dialCode: "+352" },
  { code: "MO", name: "Macau", dialCode: "+853" },
  { code: "MG", name: "Madagascar", dialCode: "+261" },
  { code: "MW", name: "Malawi", dialCode: "+265" },
  { code: "MY", name: "Malaysia", dialCode: "+60" },
  { code: "MV", name: "Maldives", dialCode: "+960" },
  { code: "ML", name: "Mali", dialCode: "+223" },
  { code: "MT", name: "Malta", dialCode: "+356" },
  { code: "MH", name: "Marshall Islands", dialCode: "+692" },
  { code: "MR", name: "Mauritania", dialCode: "+222" },
  { code: "MU", name: "Mauritius", dialCode: "+230" },
  { code: "MX", name: "Mexico", dialCode: "+52" },
  { code: "FM", name: "Micronesia", dialCode: "+691" },
  { code: "MD", name: "Moldova", dialCode: "+373" },
  { code: "MC", name: "Monaco", dialCode: "+377" },
  { code: "MN", name: "Mongolia", dialCode: "+976" },
  { code: "ME", name: "Montenegro", dialCode: "+382" },
  { code: "MA", name: "Morocco", dialCode: "+212" },
  { code: "MZ", name: "Mozambique", dialCode: "+258" },
  { code: "MM", name: "Myanmar", dialCode: "+95" },
  { code: "NA", name: "Namibia", dialCode: "+264" },
  { code: "NR", name: "Nauru", dialCode: "+674" },
  { code: "NP", name: "Nepal", dialCode: "+977" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "NZ", name: "New Zealand", dialCode: "+64" },
  { code: "NI", name: "Nicaragua", dialCode: "+505" },
  { code: "NE", name: "Niger", dialCode: "+227" },
  { code: "NG", name: "Nigeria", dialCode: "+234" },
  { code: "KP", name: "North Korea", dialCode: "+850" },
  { code: "MK", name: "North Macedonia", dialCode: "+389" },
  { code: "NO", name: "Norway", dialCode: "+47" },
  { code: "OM", name: "Oman", dialCode: "+968" },
  { code: "PK", name: "Pakistan", dialCode: "+92" },
  { code: "PW", name: "Palau", dialCode: "+680" },
  { code: "PS", name: "Palestine", dialCode: "+970" },
  { code: "PA", name: "Panama", dialCode: "+507" },
  { code: "PG", name: "Papua New Guinea", dialCode: "+675" },
  { code: "PY", name: "Paraguay", dialCode: "+595" },
  { code: "PE", name: "Peru", dialCode: "+51" },
  { code: "PH", name: "Philippines", dialCode: "+63" },
  { code: "PL", name: "Poland", dialCode: "+48" },
  { code: "PT", name: "Portugal", dialCode: "+351" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1787" },
  { code: "QA", name: "Qatar", dialCode: "+974" },
  { code: "RO", name: "Romania", dialCode: "+40" },
  { code: "RU", name: "Russia", dialCode: "+7" },
  { code: "RW", name: "Rwanda", dialCode: "+250" },
  { code: "KN", name: "Saint Kitts and Nevis", dialCode: "+1869" },
  { code: "LC", name: "Saint Lucia", dialCode: "+1758" },
  { code: "VC", name: "Saint Vincent", dialCode: "+1784" },
  { code: "WS", name: "Samoa", dialCode: "+685" },
  { code: "SM", name: "San Marino", dialCode: "+378" },
  { code: "ST", name: "Sao Tome and Principe", dialCode: "+239" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { code: "SN", name: "Senegal", dialCode: "+221" },
  { code: "RS", name: "Serbia", dialCode: "+381" },
  { code: "SC", name: "Seychelles", dialCode: "+248" },
  { code: "SL", name: "Sierra Leone", dialCode: "+232" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "SK", name: "Slovakia", dialCode: "+421" },
  { code: "SI", name: "Slovenia", dialCode: "+386" },
  { code: "SB", name: "Solomon Islands", dialCode: "+677" },
  { code: "SO", name: "Somalia", dialCode: "+252" },
  { code: "ZA", name: "South Africa", dialCode: "+27" },
  { code: "SS", name: "South Sudan", dialCode: "+211" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94" },
  { code: "SD", name: "Sudan", dialCode: "+249" },
  { code: "SR", name: "Suriname", dialCode: "+597" },
  { code: "SZ", name: "Swaziland", dialCode: "+268" },
  { code: "SE", name: "Sweden", dialCode: "+46" },
  { code: "CH", name: "Switzerland", dialCode: "+41" },
  { code: "SY", name: "Syria", dialCode: "+963" },
  { code: "TW", name: "Taiwan", dialCode: "+886" },
  { code: "TJ", name: "Tajikistan", dialCode: "+992" },
  { code: "TZ", name: "Tanzania", dialCode: "+255" },
  { code: "TH", name: "Thailand", dialCode: "+66" },
  { code: "TL", name: "Timor-Leste", dialCode: "+670" },
  { code: "TG", name: "Togo", dialCode: "+228" },
  { code: "TO", name: "Tonga", dialCode: "+676" },
  { code: "TT", name: "Trinidad and Tobago", dialCode: "+1868" },
  { code: "TN", name: "Tunisia", dialCode: "+216" },
  { code: "TR", name: "Turkey", dialCode: "+90" },
  { code: "TM", name: "Turkmenistan", dialCode: "+993" },
  { code: "TV", name: "Tuvalu", dialCode: "+688" },
  { code: "UG", name: "Uganda", dialCode: "+256" },
  { code: "UA", name: "Ukraine", dialCode: "+380" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "UY", name: "Uruguay", dialCode: "+598" },
  { code: "UZ", name: "Uzbekistan", dialCode: "+998" },
  { code: "VU", name: "Vanuatu", dialCode: "+678" },
  { code: "VE", name: "Venezuela", dialCode: "+58" },
  { code: "VN", name: "Vietnam", dialCode: "+84" },
  { code: "YE", name: "Yemen", dialCode: "+967" },
  { code: "ZM", name: "Zambia", dialCode: "+260" },
  { code: "ZW", name: "Zimbabwe", dialCode: "+263" },
].sort((a, b) => a.name.localeCompare(b.name));

function FlagImg({ code, size = 15 }: { code: string; size?: number }) {
  if (code.length !== 2) return <span style={{ fontSize: size }}>🌐</span>;
  return (
    <img
      src={`https://flagcdn.com/${Math.round(size * 1.33)}x${size}/${code.toLowerCase()}.png`}
      width={Math.round(size * 1.33)}
      height={size}
      alt={code}
      style={{ display: "inline-block", objectFit: "cover" }}
    />
  );
}

const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.code === "BR")!;

interface PhoneInputProps {
  value: string;
  dialCode: string;
  onPhoneChange: (value: string) => void;
  onDialCodeChange: (dialCode: string) => void;
  placeholder?: string;
  primary: string;
  textColor: string;
  className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  dialCode,
  onPhoneChange,
  onDialCodeChange,
  placeholder,
  primary,
  textColor,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    () => COUNTRIES.find((c) => c.dialCode === dialCode && c.code === "BR") ?? DEFAULT_COUNTRY,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const detectedRef = useRef(false);

  // IP-based country detection — runs once on mount
  useEffect(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;

    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((data) => {
        const found = COUNTRIES.find((c) => c.code === data.country_code);
        if (found) {
          setSelectedCountry(found);
          onDialCodeChange(found.dialCode);
        }
      })
      .catch(() => {});
  }, []);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector("[data-selected='true']");
      if (selected) {
        (selected as HTMLElement).scrollIntoView({ block: "center" });
      }
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (country: Country) => {
    setSelectedCountry(country);
    onDialCodeChange(country.dialCode);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex border border-gray-200 rounded-md overflow-visible transition-colors duration-150 focus-within:border-[var(--hp)] ${className}`}
      style={{ "--hp": primary, height: "48px" } as React.CSSProperties}
    >
      {/* Country selector trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 pr-2 pl-4 text-gray-600 shrink-0 transition-colors rounded-l-md"
      >
        <FlagImg code={selectedCountry.code} size={15} />
        <ChevronDown className="h-3 w-3 text-gray-400 ml-0.5" />
      </button>

      {/* Phone number input */}
      <input
        id="phone"
        type="tel"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d\s\-().+]/g, ""))}
        className="flex-1 px-4 pl-0 text-sm outline-none bg-white rounded-r-md h-full"
        style={{ color: textColor }}
      />

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className="absolute top-[calc(100%+4px)] left-0 z-50 w-72 bg-white border border-gray-200 rounded-md shadow-lg overflow-y-auto"
          style={{ maxHeight: "400px" }}
        >
          {COUNTRIES.map((country) => {
            const isSelected = country.code === selectedCountry.code;
            return (
              <button
                key={`${country.code}-${country.dialCode}`}
                type="button"
                data-selected={isSelected}
                onClick={() => handleSelect(country)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors text-black text-[15px]"
                style={{
                  backgroundColor: isSelected ? `${primary}18` : undefined,
                  color: isSelected ? primary : "#374151",
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                {/* <span className="shrink-0"><FlagImg code={country.code} size={14} /></span> */}
                <span className="truncate">{country.name}</span>
                <span className="shrink-0">({country.dialCode})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
