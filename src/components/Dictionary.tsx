import { useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";
import { SignHand, toSignTokens } from "../signAlphabet";
import { useFavorites } from "../hooks/useFavorites";
import { useTTS } from "../hooks/useSpeech";
import SuggestSign from "./SuggestSign";

interface SignWord {
  word: string;
  category: string;
  description?: string;
}

const CATEGORIES = [
  { id: "all",     label: "Todos",        icon: "🔍" },
  { id: "saludos", label: "Saludos",      icon: "👋" },
  { id: "familia", label: "Familia",      icon: "👨‍👩‍👧‍👦" },
  { id: "emociones", label: "Emociones",  icon: "😊" },
  { id: "comida",  label: "Comida",       icon: "🍽️" },
  { id: "colores", label: "Colores",      icon: "🎨" },
  { id: "numeros", label: "Números",      icon: "🔢" },
  { id: "tiempo",  label: "Tiempo",       icon: "⏰" },
  { id: "trabajo", label: "Trabajo",      icon: "💼" },
  { id: "cuerpo",  label: "Cuerpo",       icon: "🧍" },
  { id: "lugar",   label: "Lugares",      icon: "🏠" },
];

const SIGN_WORDS: SignWord[] = [
  // Saludos
  { word: "HOLA", category: "saludos", description: "Saludo inicial" },
  { word: "ADIOS", category: "saludos", description: "Despedida" },
  { word: "BUENOS DIAS", category: "saludos", description: "Saludo matutino" },
  { word: "BUENAS TARDES", category: "saludos", description: "Saludo vespertino" },
  { word: "BUENAS NOCHES", category: "saludos", description: "Saludo nocturno" },
  { word: "GRACIAS", category: "saludos", description: "Agradecimiento" },
  { word: "POR FAVOR", category: "saludos", description: "Cortesía" },
  { word: "PERDON", category: "saludos", description: "Disculpa" },
  { word: "DE NADA", category: "saludos", description: "Respuesta a gracias" },

  // Familia
  { word: "MAMA", category: "familia", description: "Madre" },
  { word: "PAPA", category: "familia", description: "Padre" },
  { word: "HERMANO", category: "familia", description: "Hermano" },
  { word: "HERMANA", category: "familia", description: "Hermana" },
  { word: "ABUELO", category: "familia", description: "Abuelo" },
  { word: "ABUELA", category: "familia", description: "Abuela" },
  { word: "HIJO", category: "familia", description: "Hijo" },
  { word: "HIJA", category: "familia", description: "Hija" },
  { word: "PRIMO", category: "familia", description: "Primo/a" },
  { word: "TIO", category: "familia", description: "Tío" },
  { word: "TIA", category: "familia", description: "Tía" },
  { word: "AMIGO", category: "familia", description: "Amigo/a" },

  // Emociones
  { word: "FELIZ", category: "emociones", description: "Alegría" },
  { word: "TRISTE", category: "emociones", description: "Tristeza" },
  { word: "ENOJADO", category: "emociones", description: "Ira" },
  { word: "ASUSTADO", category: "emociones", description: "Miedo" },
  { word: "SORPRENDIDO", category: "emociones", description: "Sorpresa" },
  { word: "CANSADO", category: "emociones", description: "Fatiga" },
  { word: "ENFERMO", category: "emociones", description: "Malestar" },
  { word: "BIEN", category: "emociones", description: "Estado positivo" },
  { word: "MAL", category: "emociones", description: "Estado negativo" },
  { word: "AMOR", category: "emociones", description: "Afecto" },

  // Comida
  { word: "AGUA", category: "comida", description: "Bebida" },
  { word: "COMIDA", category: "comida", description: "Alimento" },
  { word: "PAN", category: "comida", description: "Pan" },
  { word: "LECHE", category: "comida", description: "Leche" },
  { word: "CAFE", category: "comida", description: "Café" },
  { word: "FRUTA", category: "comida", description: "Fruta" },
  { word: "CARNE", category: "comida", description: "Carne" },
  { word: "PESCADO", category: "comida", description: "Pescado" },
  { word: "VERDURA", category: "comida", description: "Verdura" },
  { word: "DULCE", category: "comida", description: "Dulce" },
  { word: "SAL", category: "comida", description: "Sal" },
  { word: "AZUCAR", category: "comida", description: "Azúcar" },

  // Colores
  { word: "ROJO", category: "colores", description: "Color rojo" },
  { word: "AZUL", category: "colores", description: "Color azul" },
  { word: "VERDE", category: "colores", description: "Color verde" },
  { word: "AMARILLO", category: "colores", description: "Color amarillo" },
  { word: "NEGRO", category: "colores", description: "Color negro" },
  { word: "BLANCO", category: "colores", description: "Color blanco" },
  { word: "NARANJA", category: "colores", description: "Color naranja" },
  { word: "ROSA", category: "colores", description: "Color rosa" },
  { word: "MARRON", category: "colores", description: "Color marrón" },
  { word: "GRIS", category: "colores", description: "Color gris" },
  { word: "MORADO", category: "colores", description: "Color morado" },

  // Números
  { word: "UNO", category: "numeros", description: "1" },
  { word: "DOS", category: "numeros", description: "2" },
  { word: "TRES", category: "numeros", description: "3" },
  { word: "CUATRO", category: "numeros", description: "4" },
  { word: "CINCO", category: "numeros", description: "5" },
  { word: "SEIS", category: "numeros", description: "6" },
  { word: "SIETE", category: "numeros", description: "7" },
  { word: "OCHO", category: "numeros", description: "8" },
  { word: "NUEVE", category: "numeros", description: "9" },
  { word: "DIEZ", category: "numeros", description: "10" },

  // Tiempo
  { word: "HOY", category: "tiempo", description: "Día actual" },
  { word: "AYER", category: "tiempo", description: "Día anterior" },
  { word: "MANANA", category: "tiempo", description: "Día siguiente" },
  { word: "AHORA", category: "tiempo", description: "Momento presente" },
  { word: "DESPUES", category: "tiempo", description: "Posterior" },
  { word: "ANTES", category: "tiempo", description: "Anterior" },
  { word: "SIEMPRE", category: "tiempo", description: "Permanente" },
  { word: "NUNCA", category: "tiempo", description: "Negación temporal" },
  { word: "PRONTO", category: "tiempo", description: "Cercano" },
  { word: "TARDE", category: "tiempo", description: "Retraso" },

  // Trabajo
  { word: "TRABAJO", category: "trabajo", description: "Labor" },
  { word: "ESCUELA", category: "trabajo", description: "Centro educativo" },
  { word: "ESTUDIAR", category: "trabajo", description: "Aprender" },
  { word: "LIBRO", category: "trabajo", description: "Libro" },
  { word: "ESCRIBIR", category: "trabajo", description: "Escribir" },
  { word: "LEER", category: "trabajo", description: "Leer" },
  { word: "DINERO", category: "trabajo", description: "Moneda" },
  { word: "COMPRAR", category: "trabajo", description: "Adquirir" },
  { word: "VENDER", category: "trabajo", description: "Vender" },

  // Cuerpo
  { word: "CABEZA", category: "cuerpo", description: "Cabeza" },
  { word: "OJO", category: "cuerpo", description: "Ojo" },
  { word: "BOCA", category: "cuerpo", description: "Boca" },
  { word: "MANO", category: "cuerpo", description: "Mano" },
  { word: "PIE", category: "cuerpo", description: "Pie" },
  { word: "CORAZON", category: "cuerpo", description: "Corazón" },
  { word: "DIENTE", category: "cuerpo", description: "Diente" },
  { word: "NARIZ", category: "cuerpo", description: "Nariz" },
  { word: "OREJA", category: "cuerpo", description: "Oreja" },

  // Lugares
  { word: "CASA", category: "lugar", description: "Hogar" },
  { word: "HOSPITAL", category: "lugar", description: "Centro médico" },
  { word: "ESCUELA", category: "lugar", description: "Colegio" },
  { word: "TIENDA", category: "lugar", description: "Comercio" },
  { word: "PARQUE", category: "lugar", description: "Jardín público" },
  { word: "BANO", category: "lugar", description: "Aseo" },
  { word: "COCINA", category: "lugar", description: "Cocina" },
  { word: "CALLE", category: "lugar", description: "Vía pública" },
];

interface Props {
  lang: LangDef;
}

export default function Dictionary({ lang }: Props) {
  const [activeCat, setActiveCat] = useState("all");
  const [selectedWord, setSelectedWord] = useState<SignWord | null>(null);
  const [playingIdx, setPlayingIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const { favorites, toggle, isFav } = useFavorites();
  const { speak } = useTTS();

  const filtered = activeCat === "all"
    ? SIGN_WORDS
    : SIGN_WORDS.filter(w => w.category === activeCat);

  const playWord = (word: string) => {
    const tokens = toSignTokens(word);
    setPlayingIdx(0);
    setIsPlaying(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setPlayingIdx(i);
      if (i >= tokens.length) {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, speed);
  };

  const handleShare = async (word: string) => {
    const text = `${word} — ${t(lang.code, "appName")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t(lang.code, "appName"), text });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const currentTokens = selectedWord ? toSignTokens(selectedWord.word) : [];
  const currentLetter = currentTokens[playingIdx] || "";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="glass rounded-3xl p-4">
        <h2 className="mb-1 text-xl font-bold">📖 {t(lang.code, "dictionary")}</h2>
        <p className="text-sm text-white/70">{t(lang.code, "dictionaryDesc")}</p>
      </div>

      {/* Category pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              activeCat === cat.id
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Word count */}
      <div className="text-xs text-white/50">
        {filtered.length} {filtered.length === 1 ? "signo" : "signos"}
      </div>

      {/* Word grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map(item => (
          <button
            key={item.word}
            onClick={() => { setSelectedWord(item); playWord(item.word); speak(item.word, lang); }}
            className="group relative rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
          >
            <div className="flex items-start justify-between gap-1">
              <div className="text-sm font-bold leading-tight">{item.word}</div>
              <button
                onClick={e => { e.stopPropagation(); toggle(item.word, item.category); }}
                className="text-lg leading-none opacity-40 transition hover:opacity-100"
              >
                {isFav(item.word) ? "★" : "☆"}
              </button>
            </div>
            <div className="mt-1 text-[11px] text-white/50">{item.description}</div>
          </button>
        ))}
      </div>

      {/* Favorites section */}
      {favorites.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <h3 className="mb-2 text-sm font-semibold text-white/80">⭐ {t(lang.code, "favorites")}</h3>
          <div className="flex flex-wrap gap-2">
            {favorites.map(fav => (
              <button
                key={fav.id}
                onClick={() => {
                  const word = SIGN_WORDS.find(w => w.word === fav.text);
                  if (word) { setSelectedWord(word); playWord(word.word); }
                }}
                className="flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-400/30"
              >
                {fav.text}
                <span onClick={e => { e.stopPropagation(); toggle(fav.text); }} className="ml-1 opacity-60">✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected word detail */}
      {selectedWord && (
        <div className="glass rounded-3xl p-5 text-center">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">
            {CATEGORIES.find(c => c.id === selectedWord.category)?.label}
          </div>
          <div className="mb-3 text-2xl font-extrabold">{selectedWord.word}</div>
          <div className="mb-4 flex justify-center">
            <SignHand letter={currentLetter} size={200} active={isPlaying} />
          </div>
          <div className="mb-3 flex items-center justify-center gap-1 text-lg font-bold tracking-wider">
            {currentTokens.map((tk, i) => (
              <span key={i} className={i === playingIdx ? "rounded bg-indigo-500 px-1.5 py-0.5 text-white" : i < playingIdx ? "text-white/80" : "text-white/30"}>
                {tk}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => playWord(selectedWord.word)}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow active:scale-95"
            >▶ {t(lang.code, "play")}</button>
            <button
              onClick={() => speak(selectedWord.word, lang)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm active:scale-95"
            >🔊 {t(lang.code, "speak")}</button>
            <button
              onClick={() => handleShare(selectedWord.word)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm active:scale-95"
            >📤 {t(lang.code, "share")}</button>
            <button
              onClick={() => toggle(selectedWord.word, selectedWord.category)}
              className={`rounded-xl px-4 py-2 text-sm active:scale-95 ${isFav(selectedWord.word) ? "bg-amber-500/30 text-amber-200" : "bg-white/10"}`}
            >{isFav(selectedWord.word) ? "★" : "☆"}</button>
          </div>
          <div className="mt-3">
            <input
              type="range" min={200} max={1200} step={50}
              value={speed} onChange={e => setSpeed(Number(e.target.value))}
              className="w-full accent-indigo-400"
            />
            <div className="text-[10px] text-white/50">{t(lang.code, "speed")}: {(1000/speed).toFixed(1)} letras/s</div>
          </div>
        </div>
      )}

      {/* Suggest new sign */}
      <SuggestSign lang={lang} />
    </div>
  );
}
