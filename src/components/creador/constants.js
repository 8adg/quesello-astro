export const STAMP_WIDTH_MM = 36;
export const STAMP_HEIGHT_MM = 15;
export const FACTOR_PT_A_MM = 0.3527;
export const PRECIO_SELLO = 20500;

export const PROFESSIONAL_FONTS = [
  { id: 'Aleo Italic', label: 'Aleo Italic', css: "'Aleo', serif", fontStyle: 'italic', fontWeight: '400' },
  { id: 'Aleo Regular', label: 'Aleo Regular', css: "'Aleo', serif", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Amaze (Manuscrita)', label: 'Amaze (Manuscrita)', css: "'Amaze', cursive", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Great Vibes', label: 'Great Vibes', css: "'Great Vibes', cursive", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Mukta Mahee', label: 'Mukta Mahee', css: "'Mukta Mahee', sans-serif", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Mukta Mahee SemiBold', label: 'Mukta Mahee SemiBold', css: "'Mukta Mahee', sans-serif", fontStyle: 'normal', fontWeight: '600' },
  { id: 'Playwrite', label: 'Playwrite', css: "'Playwrite DK Uloopet', cursive", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Roboto Regular', label: 'Roboto Regular', css: "'Roboto', sans-serif", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Roboto Medium', label: 'Roboto Medium', css: "'Roboto', sans-serif", fontStyle: 'normal', fontWeight: '500' },
  { id: 'Arial', label: 'Arial (Sistema)', css: "Arial, sans-serif", fontStyle: 'normal', fontWeight: 'normal' }
];

export const SCHOOL_FONTS = [
  { id: 'Mi Negra', label: 'Mi Negra', css: "'Mi Negra', 'Fredoka', 'Comfortaa', sans-serif", fontStyle: 'normal', fontWeight: '900' },
  { id: 'Playwrite DK Uloopet', label: 'Playwrite DK Uloopet', css: "'Playwrite DK Uloopet', cursive", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Patrick Hand', label: 'Patrick Hand', css: "'Patrick Hand', cursive", fontStyle: 'normal', fontWeight: '400' },
  { id: 'Figtree', label: 'Figtree', css: "'Figtree', sans-serif", fontStyle: 'normal', fontWeight: '700' },
  { id: 'Quicksand', label: 'Quicksand', css: "'Quicksand', sans-serif", fontStyle: 'normal', fontWeight: '600' },
  { id: 'Comfortaa', label: 'Comfortaa', css: "'Comfortaa', cursive, sans-serif", fontStyle: 'normal', fontWeight: '700' },
  { id: 'Comic Sans MS', label: 'Comic Sans MS', css: "'Comic Sans MS', 'Comic Neue', cursive", fontStyle: 'normal', fontWeight: 'bold' }
];

export const SCHOOL_ICONS = [
  { id: 1, name: "AFA", file: "/iconos/sellos-escolares/1.svg" },
  { id: 2, name: "Stitch", file: "/iconos/sellos-escolares/2.svg" },
  { id: 3, name: "Messi 10", file: "/iconos/sellos-escolares/3.svg" },
  { id: 4, name: "Avioncito Papel", file: "/iconos/sellos-escolares/4.svg" },
  { id: 5, name: "Guitarra", file: "/iconos/sellos-escolares/5.svg" },
  { id: 6, name: "Labubu", file: "/iconos/sellos-escolares/6.svg" },
  { id: 7, name: "Fútbol Botín", file: "/iconos/sellos-escolares/7.svg" },
  { id: 8, name: "Robot", file: "/iconos/sellos-escolares/8.svg" },
  { id: 9, name: "Osito Peluche", file: "/iconos/sellos-escolares/9.svg" },
  { id: 10, name: "Dinosaurio", file: "/iconos/sellos-escolares/10.svg" },
  { id: 11, name: "Cohete", file: "/iconos/sellos-escolares/11.svg" },
  { id: 12, name: "Mickey Mouse", file: "/iconos/sellos-escolares/12.svg" },
  { id: 13, name: "Conejito", file: "/iconos/sellos-escolares/13.svg" },
  { id: 14, name: "Estrella Doble", file: "/iconos/sellos-escolares/14.svg" },
  { id: 15, name: "Mariposa", file: "/iconos/sellos-escolares/15.svg" },
  { id: 16, name: "Flor", file: "/iconos/sellos-escolares/16.svg" },
  { id: 17, name: "Gallinita", file: "/iconos/sellos-escolares/17.svg" },
  { id: 18, name: "Emoji Risa", file: "/iconos/sellos-escolares/18.svg" },
  { id: 19, name: "Emoji Sonrisa", file: "/iconos/sellos-escolares/19.svg" },
  { id: 20, name: "Emoji Corazones", file: "/iconos/sellos-escolares/20.svg" },
  { id: 21, name: "Avión Hélice", file: "/iconos/sellos-escolares/21.svg" },
  { id: 22, name: "Estrella Sonriente", file: "/iconos/sellos-escolares/22.svg" },
  { id: 23, name: "Corazón Sonriente", file: "/iconos/sellos-escolares/23.svg" },
  { id: 24, name: "Autito", file: "/iconos/sellos-escolares/24.svg" },
  { id: 25, name: "Patines", file: "/iconos/sellos-escolares/25.svg" }
];

export const INITIAL_PROFESSIONAL_DATA = [
  { texto: "Juan Pérez Pardo", fuente: "Aleo Italic", size: 12, offset_y: -1.0, offset_x: 0.0 },
  { texto: "MÉDICO CLÍNICO", fuente: "Mukta Mahee SemiBold", size: 9, offset_y: -1.9, offset_x: 0.0 },
  { texto: "Matrícula N° 20408978", fuente: "Roboto Medium", size: 9, offset_y: -0.9, offset_x: 0.0 }
];

export const INITIAL_SCHOOL_DATA = {
  iconId: 17, // Gallinita / ícono escolar
  iconSize: 8.5, // tamaño en mm
  iconOffsetX: -2.0, // ajuste horizontal mm
  iconOffsetY: -3.5, // ajuste vertical mm
  escalarIgual: true, // constrain de tamaño para Nombre y Apellido
  lineas: [
    { texto: "Macarena", fuente: "Playwrite DK Uloopet", size: 10, offset_y: -0.5, offset_x: 0.0 },
    { texto: "Aberastain Oro", fuente: "Playwrite DK Uloopet", size: 10, offset_y: -0.5, offset_x: -0.5 },
    { texto: "HOJA: ____", fuente: "Quicksand", size: 9, offset_y: 0.0, offset_x: 0.0 }
  ]
};

