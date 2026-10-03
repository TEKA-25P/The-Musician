import os
import json
import subprocess
import re

LILYPOND_EXE = r"D:\Codes\Apps\TEKA_Project\Music Notations\Lilypond\bin\lilypond.exe"
INPUT_FOLDER = r"D:\Codes\Apps\TEKA_Project\Music Notations\songs"
OUTPUT_FOLDER = r"D:\Codes\Apps\TEKA_Project\Music Notations\output"

def parse_readable_pitch(pitch_str, is_drum=False):
    pitch_str = pitch_str.strip()
    if not pitch_str or pitch_str.upper() == "R":
        return "r"
        
    if is_drum:
        return pitch_str.lower()
        
    match = re.match(r"^([A-G,a-g])([#bBZdHh]?)(-?\d)", pitch_str)
    if not match:
        return pitch_str.lower()
        
    note_name = match.group(1).lower()
    accidental_input = match.group(2)
    octave = int(match.group(3))
    
    accidental = ""
    if accidental_input == "#": 
        accidental = "is"
    elif accidental_input.lower() == "b": 
        accidental = "es"
    elif accidental_input.lower() in ["z", "d"]: 
        accidental = "eh"
    elif accidental_input.lower() == "h": 
        accidental = "ih"

    octave_diff = octave - 4
    if octave_diff == 0: 
        octave_marker = "'"
    elif octave_diff > 0: 
        octave_marker = "'" * (octave_diff + 1)
    else: 
        octave_marker = "," * abs(octave_diff + 1)
        
    return f"{note_name}{accidental}{octave_marker}"

def convert_key_root(key_str):
    key_str = key_str.strip()
    if not key_str:
        return "c"
        
    match = re.match(r"^([A-G,a-g])([#bBZdHh]?)$", key_str)
    if not match:
        return key_str.lower()
        
    root = match.group(1).lower()
    accidental = match.group(2)
    
    if accidental == "#":
        return f"{root}is"
    elif accidental.lower() == "b":
        return f"{root}es"
    elif accidental.lower() in ["z", "d"]:
        return f"{root}eh"
    elif accidental.lower() == "h":
        return f"{root}ih"
        
    return root

def clean_chord_notation(chord_str):
    chord_str = chord_str.strip()
    if not chord_str or chord_str.upper() in ["N.C.", "NC", "NONE"]:
        return "s"
        
    if chord_str.lower() in ["s", "r"]:
        return chord_str.lower()
    
    match = re.match(r"^([A-G,a-g])([#bB]?)(.*)$", chord_str)
    if not match:
        return chord_str.lower()
        
    root = match.group(1).lower()
    accidental_input = match.group(2)
    modifier = match.group(3)
    
    accidental = ""
    if accidental_input == "#":
        accidental = "is"
    elif accidental_input.lower() == "b":
        accidental = "es"
        
    ly_chord = f"{root}{accidental}"
    
    if modifier:
        modifier = modifier.lower()
        if modifier in ["m", "min"]:
            ly_chord += ":m"
        elif modifier in ["7"]:
            ly_chord += ":7"
        elif modifier in ["m7", "min7"]:
            ly_chord += ":m7"
        elif modifier in ["maj7", "maj"]:
            ly_chord += ":maj7"
        elif modifier in ["dim"]:
            ly_chord += ":dim"
        elif modifier in ["sus4"]:
            ly_chord += ":sus4"
        elif modifier in ["6"]:
            ly_chord += ":6"
            
    return ly_chord

def convert_duration(beats):
    if beats >= 4.0: return "1"
    elif beats >= 3.0: return "2."
    elif beats >= 2.0: return "2"
    elif beats >= 1.5: return "4."
    elif beats >= 1.0: return "4"
    elif beats >= 0.75: return "8."  
    elif beats >= 0.5: return "8"
    elif beats >= 0.25: return "16"  
    return "16"

MAQAM_MAP = {
    "bayati": "major", "rast": "major", "sikah": "major",
    "saba": "minor", "hijaz": "minor", "nahawand": "minor", "kurd": "minor"
}

def parse_flexible_notes(note_list, is_drum=False, text_color='"white"', target_font="Segoe Print"):
    if not note_list:
        return "r1"
        
    translated_tokens = []
    in_tuplet = False
    
    for item in note_list:
        if isinstance(item, dict):
            event_type = item.get("type", "note")
            
            if event_type == "signature_change":
                if in_tuplet:
                    translated_tokens.append("}")
                    in_tuplet = False
                change_tokens = []
                if "time_signature" in item:
                    change_tokens.append(f"\\time {item['time_signature']}")
                if "key_root" in item or "scale_mode" in item:
                    new_root = convert_key_root(item.get("key_root", "C"))
                    new_mode = item.get("scale_mode", "major").lower()
                    new_mode = MAQAM_MAP.get(new_mode, new_mode)
                    change_tokens.append(f"\\key {new_root} \\{new_mode}")
                if change_tokens:
                    translated_tokens.append(" ".join(change_tokens))
                continue

            tempo_prefix = ""
            if "tempo_bpm" in item:
                bpm = item['tempo_bpm']
                tempo_prefix = f"\\tempo 4 = {bpm} "
            
            style_change_prefix = ""
            if "change_style" in item:
                mod = item["change_style"]
                if "font_color" in mod:
                    color = mod["font_color"]
                    if not color.startswith('"'): color = f'"{color}"'
                    style_change_prefix += f"\\override NoteHead.color = {color} \\override Stem.color = {color} \\override Beam.color = {color} \\override Flag.color = {color} "
                if "font_serif" in mod:
                    style_change_prefix += f"\\override TextScript.font-name = #\"{mod['font_serif']}\" "

            if event_type == "repeat_section":
                if in_tuplet:
                    translated_tokens.append("}")
                    in_tuplet = False
                repeat_times = item.get("times", 2)
                inner_notes = item.get("notes") if item.get("notes") else item.get("base_notes", [])
                inner_compiled_str = parse_flexible_notes(inner_notes, is_drum=is_drum, text_color=text_color, target_font=target_font)
                translated_tokens.append(f"{tempo_prefix}{style_change_prefix}\\repeat volta {repeat_times} {{ {inner_compiled_str} }}")
                continue
            
            if event_type == "repeat_with_alternatives":
                if in_tuplet:
                    translated_tokens.append("}")
                    in_tuplet = False
                repeat_times = item.get("times", 2)
                base_notes = item.get("notes") if item.get("notes") else item.get("base_notes", [])
                alternatives = item.get("endings", [])
                
                base_compiled = parse_flexible_notes(base_notes, is_drum=is_drum, text_color=text_color, target_font=target_font)
                alt_compiled_blocks = [f"{{ {parse_flexible_notes(alt_list, is_drum=is_drum, text_color=text_color, target_font=target_font)} }}" for alt_list in alternatives]
                all_alts_str = " ".join(alt_compiled_blocks)
                
                translated_tokens.append(f"{tempo_prefix}{style_change_prefix}\\repeat volta {repeat_times} {{ {base_compiled} }} \\alternative {{ {all_alts_str} }}")
                continue
                
            beats = item.get("beats", 1.0)
            dur = convert_duration(beats)
            bar_ending = item.get("bar_ending", None)
            token_str = ""
            
            tuplet_setting = item.get("tuplet", "")
            tuplet_prefix = ""
            tuplet_suffix = ""
            
            if tuplet_setting == "triplet_start" or tuplet_setting == "start":
                if not in_tuplet:
                    tuplet_prefix = "\\tuplet 3/2 { "
                    in_tuplet = True
            elif tuplet_setting == "stop":
                if in_tuplet:
                    tuplet_suffix = " }"
                    in_tuplet = False
            
            style_suffix = ""
            if item.get("slur") == "start":
                style_suffix += "("
            elif item.get("slur") == "stop":
                style_suffix += ")"
                
            if item.get("glissando", False):
                style_suffix += " \\glissando"
                
            if item.get("accent", False):
                style_suffix += " ->"
                
            if "comment" in item and item["comment"]:
                clean_comment = str(item["comment"]).replace('"', '\\"')
                style_suffix += f'-\\markup {{ "{clean_comment}" }}'
                
            if "lyric" in item and item["lyric"]:
                clean_lyric = str(item["lyric"]).replace('"', '\\"')
                style_suffix += f'-\\markup {{ "{clean_lyric}" }}'

            appoggiatura_prefix = ""
            if "appoggiatura_pitch" in item:
                app_pitch = parse_readable_pitch(item["appoggiatura_pitch"], is_drum=is_drum)
                appoggiatura_prefix = f"\\appoggiatura {app_pitch} "

            if event_type == "note":
                token_str = f"{tuplet_prefix}{tempo_prefix}{style_change_prefix}{appoggiatura_prefix}{parse_readable_pitch(item.get('pitch', 'C4'), is_drum=is_drum)}{dur}{style_suffix}{tuplet_suffix}"
            elif event_type == "rest":
                token_str = f"{tuplet_prefix}{tempo_prefix}{style_change_prefix}r{dur}{tuplet_suffix}"
            elif event_type == "chord":
                pitches = [parse_readable_pitch(p, is_drum=is_drum) for p in item.get("pitches", [])]
                arp_suffix = " \\arpeggio" if item.get("arpeggio", False) else ""
                token_str = f"{tuplet_prefix}{tempo_prefix}{style_change_prefix}{appoggiatura_prefix}<{ ' '.join(pitches) }>{dur}{arp_suffix}{style_suffix}{tuplet_suffix}"
                
            if bar_ending == "double_bar":
                token_str = f"{token_str} \\bar \"||\""
            elif bar_ending == "final_bar":
                token_str = f"{token_str} \\bar \"|.\""
                
            if token_str:
                translated_tokens.append(token_str)
        else:
            if in_tuplet:
                translated_tokens.append("}")
                in_tuplet = False
            raw_str = str(item).strip()
            if len(raw_str) >= 3 and raw_str[-1].isdigit() and raw_str[-2].isdigit():
                pitch_part = raw_str[:-1]
                dur_part = raw_str[-1]
                clean_pitch = parse_readable_pitch(pitch_part, is_drum=is_drum)
                translated_tokens.append(f"{clean_pitch}{dur_part}")
            else:
                clean_pitch = parse_readable_pitch(raw_str, is_drum=is_drum)
                translated_tokens.append(f"{clean_pitch}4")
                
    if in_tuplet:
        translated_tokens.append("}")
            
    return " ".join(translated_tokens)

def build_score_syntax(data):
    title = data.get("title", "Musical Score Blueprint")
    subtitle = data.get("subtitle", "")
    composer = data.get("composer", "Anonymous")
    initial_tempo = data.get("tempo_bpm", 120)
    time_sig = data.get("time_signature", "4/4")
    
    raw_key = data.get("key_root", "C")
    ly_key_root = convert_key_root(raw_key)
    
    scale_mode = data.get("scale_mode", "major").lower()
    if scale_mode in MAQAM_MAP:
        scale_mode = MAQAM_MAP[scale_mode]
    
    target_font = "Segoe Print"
    
    text_color = '"white"'
    note_color = '"white"'
    staff_color = '"white"'

    bg_post_process = """
  page-post-process = #(lambda (layout pages)
    (for-each (lambda (page)
                (let* ((page-stencil (ly:prob-property page 'stencil))
                       (X-ext (ly:stencil-extent page-stencil X))
                       (Y-ext (ly:stencil-extent page-stencil Y))
                       (bg-stencil (stencil-with-color (make-filled-box-stencil X-ext Y-ext) (rgb-color 0.12 0.12 0.12))))
                  (ly:prob-set-property! page 'stencil (ly:stencil-add bg-stencil page-stencil))))
              pages))"""

    has_chords = 1 if ("chord_symbols" in data and isinstance(data["chord_symbols"], list) and data["chord_symbols"]) else 0
    has_piano = 1 if ("piano_staff" in data and data["piano_staff"]) else 0
    has_guitar = 1 if ("guitar_staff" in data and data["guitar_staff"]) else 0
    has_vocal = 1 if ("vocal_staff" in data and data["vocal_staff"]) else 0
    has_drums = 1 if ("drum_staff" in data and data["drum_staff"]) else 0

    instrument_count = sum([has_piano, has_guitar, has_vocal, has_drums])
    
    global_musical_context = (
        f"\\numericTimeSignature \\time {time_sig} \\tempo 4 = {initial_tempo} "
        f"\\set Timing.beamExceptions = #'() "
        f"\\set Timing.baseMoment = #(ly:make-moment 1/4) "
        f"\\set Timing.beatStructure = #'(1 1 1 1)"
    )
    
    chords_syntax_block = ""
    if has_chords:
        chord_tokens = []
        for ch in data["chord_symbols"]:
            if isinstance(ch, dict):
                if ch.get("type") == "signature_change":
                    if "time_signature" in ch:
                        chord_tokens.append(f"\\time {ch['time_signature']}")
                    continue
                
                ch_name = clean_chord_notation(ch.get("chord", "c"))
                ch_beats = ch.get("beats", 1.0)
                ch_dur = convert_duration(ch_beats)
                
                if ":" in ch_name:
                    root_part, mod_part = ch_name.split(":", 1)
                    formatted_chord = f"{root_part}{ch_dur}:{mod_part}"
                else:
                    formatted_chord = f"{ch_name}{ch_dur}"
                    
                chord_tokens.append(formatted_chord)
        if chord_tokens:
            chords_syntax_block = f"""\\new ChordNames \\with {{
      \\override ChordName.color = {text_color}
      \\override ChordName.font-name = #\"{target_font}\"
    }} {{ {global_musical_context} \\chordmode {{ {' '.join(chord_tokens)} }} }}"""

    all_staves_pdf = []
    all_staves_midi = []

    if chords_syntax_block:
        all_staves_pdf.append(chords_syntax_block)

    if has_piano:
        p_data = data["piano_staff"]
        p_inst = p_data.get("instrument", "Piano")
        p_midi = p_data.get("midi_instrument", "acoustic grand piano")
        
        piano_tracks = []
        
        if "right_hand" in p_data and p_data["right_hand"]:
            rh = parse_flexible_notes(p_data["right_hand"], text_color=text_color, target_font=target_font)
            ctx = global_musical_context if not all_staves_pdf else ""
            piano_tracks.append(f"""
          \\new Staff \\with {{
            \\override InstrumentName.color = {text_color}
            \\override InstrumentName.font-name = #"{target_font}"
            \\consists "Arpeggio_engraver"
          }} {{
            \\set Staff.instrumentName = #"{p_inst} R "
            \\set Staff.midiInstrument = #"{p_midi}"
            {ctx}
            \\clef "treble" \\key {ly_key_root} \\{scale_mode}
            {rh}
          }}""")
            
        if "left_hand" in p_data and p_data["left_hand"]:
            lh = parse_flexible_notes(p_data["left_hand"], text_color=text_color, target_font=target_font)
            ctx = global_musical_context if not all_staves_pdf and not piano_tracks else ""
            piano_tracks.append(f"""
          \\new Staff \\with {{
            \\override InstrumentName.color = {text_color}
            \\override InstrumentName.font-name = #"{target_font}"
            \\consists "Arpeggio_engraver"
          }} {{
            \\set Staff.instrumentName = #"{p_inst} L "
            \\set Staff.midiInstrument = #"{p_midi}"
            {ctx}
            \\clef "bass" \\key {ly_key_root} \\{scale_mode}
            {lh}
          }}""")
            
        if piano_tracks:
            piano_block = f"""
    \\new PianoStaff \\with {{
      \\override SystemStartBrace.color = {staff_color}
    }} << 
      {" ".join(piano_tracks)}
    >>"""
            all_staves_pdf.append(piano_block)
            all_staves_midi.append(piano_block)

    if has_guitar:
        g_data = data["guitar_staff"]
        g_inst = g_data.get("instrument", "Guitar")
        g_midi = g_data.get("midi_instrument", "acoustic guitar (nylon)")
        g_notes = parse_flexible_notes(g_data.get("notes", []), text_color=text_color, target_font=target_font)
        
        ctx = global_musical_context if not all_staves_pdf else ""
        if instrument_count == 1:
            guitar_block = f"""
    \\new StaffGroup \\with {{
      \\override SystemStartBracket.color = {staff_color}
    }} <<
      \\new Staff \\with {{
        \\override InstrumentName.color = {text_color}
        \\override InstrumentName.font-name = #"{target_font}"
        \\consists "Arpeggio_engraver"
      }} {{
        \\set Staff.instrumentName = #"{g_inst} "
        \\set Staff.midiInstrument = #"{g_midi}"
        {ctx}
        \\clef "treble_8" \\key {ly_key_root} \\{scale_mode}
        {g_notes}
      }}
      \\new TabStaff \\with {{
        stringTunings = #guitar-tuning
        \\override StaffSymbol.color = {staff_color}
      }} {{
        \\key {ly_key_root} \\{scale_mode}
        {g_notes}
      }}
    >>"""
        else:
            guitar_block = f"""
    \\new Staff \\with {{
      \\override InstrumentName.color = {text_color}
      \\override InstrumentName.font-name = #"{target_font}"
      \\consists "Arpeggio_engraver"
    }} {{
      \\set Staff.instrumentName = #"{g_inst} "
      \\set Staff.midiInstrument = #"{g_midi}"
      {ctx}
      \\clef "treble_8" \\key {ly_key_root} \\{scale_mode}
      {g_notes}
    }}"""
        all_staves_pdf.append(guitar_block)
        all_staves_midi.append(guitar_block)

    if has_vocal:
        v_data = data["vocal_staff"]
        v_inst = v_data.get("instrument", "Vocal")
        v_midi = v_data.get("midi_instrument", "voice oohs")
        v_notes = parse_flexible_notes(v_data.get("notes", []), text_color=text_color, target_font=target_font)
        
        lyrics_block = ""
        if "lyrics" in data and data["lyrics"]:
            escaped = [f'"{w}"' if w not in [" ", ""] else "__" for w in data["lyrics"]]
            lyrics_block = f"\\addlyrics {{ \\override LyricText.color = {text_color} \\override LyricText.font-name = #\"{target_font}\" {' '.join(escaped)} }}"
            
        ctx = global_musical_context if not all_staves_pdf else ""
        vocal_block = f"""
    \\new Staff \\with {{
      \\override InstrumentName.color = {text_color}
      \\override InstrumentName.font-name = #"{target_font}"
    }} {{
      \\set Staff.instrumentName = #"{v_inst} "
      \\set Staff.midiInstrument = #"{v_midi}"
      {ctx}
      \\clef "treble" \\key {ly_key_root} \\{scale_mode}
      {v_notes}
    }}
    {lyrics_block}"""
        all_staves_pdf.append(vocal_block)
        all_staves_midi.append(vocal_block)

    if has_drums:
        d_notes = parse_flexible_notes(data["drum_staff"], is_drum=True, text_color=text_color, target_font=target_font)
        ctx = global_musical_context if not all_staves_pdf else ""
        drum_block = f"""
    \\new DrumStaff \\with {{
      \\override StaffSymbol.color = {staff_color}
      \\override DrumNoteHead.color = {note_color}
      \\override InstrumentName.font-name = #"{target_font}"
      \\override InstrumentName.color = {text_color}
    }} {{
      \\set DrumStaff.instrumentName = #"Drums "
      {ctx}
      \\drummode {{ {d_notes} }}
    }}"""
        all_staves_pdf.append(drum_block)
        all_staves_midi.append(drum_block)

    combined_pdf_systems = f""" << 
    {" ".join(all_staves_pdf)} 
  >> """

    combined_midi_systems = f""" << 
    {" ".join(all_staves_midi)} 
  >> """

    subtitle_markup = f'subtitle = \\markup \\with-color {text_color} \\override #\'(font-name . "{target_font}") "{subtitle}"' if subtitle else ""

    return f"""\\version "2.24.0"

\\paper {{
  define-fonts-with-defaults = ##f
  oddHeaderMarkup = \\markup \\with-color {text_color} \\fill-line {{
    "" "" \\if \\should-print-page-number \\fromproperty #'page:page-number-string
  }}
  evenHeaderMarkup = \\markup \\with-color {text_color} \\fill-line {{
    \\if \\should-print-page-number \\fromproperty #'page:page-number-string "" ""
  }}
  oddFooterMarkup = \\markup \\with-color {text_color} \\fill-line {{
    "" \\override #'(font-name . "{target_font}") "♪TEKA" ""
  }}
  evenFooterMarkup = \\markup \\with-color {text_color} \\fill-line {{
    "" \\override #'(font-name . "{target_font}") "♪TEKA" ""
  }}
  {bg_post_process}
}}

\\header {{
  title = \\markup \\with-color {text_color} \\override #'(font-name . "{target_font}") \\bold "{title}"
  {subtitle_markup}
  composer = \\markup \\with-color {text_color} \\override #'(font-name . "{target_font}") \\italic "{composer}"
  tagline = ##f
}}

\\score {{
  {combined_pdf_systems}
  \\layout {{
    \\context {{
      \\Score
      \\override InstrumentName.font-name = #"{target_font}"
      \\override MetronomeMark.font-name = #"{target_font}"
      \\override TextScript.font-name = #"{target_font}"
      \\override LyricText.font-name = #"{target_font}"
      \\override BarNumber.font-name = #"{target_font}"
      \\override VoltaBracket.font-name = #"{target_font}"
      \\override TabNoteHead.font-name = #"{target_font}"
      \\override ChordName.font-name = #"{target_font}"

      \\override StaffSymbol.color = {staff_color}
      \\override SystemStartBar.color = {staff_color}
      \\override SystemStartBrace.color = {staff_color}        
      \\override SystemStartBracket.color = {staff_color}      
      \\override SpanBar.color = {staff_color}                  
      \\override BarLine.color = {staff_color}
      \\override LedgerLineSpanner.color = {staff_color}

      \\override NoteHead.color = {note_color}
      \\override Accidental.color = {note_color}                
      \\override AccidentalPlacement.color = {note_color}      
      \\override Clef.color = {note_color}
      \\override KeySignature.color = {note_color}
      \\override TimeSignature.color = {note_color}
      \\override BarNumber.color = {text_color}                 
      \\override Stem.color = {note_color}
      \\override Beam.color = {note_color}
      \\override Flag.color = {note_color}
      \\override Rest.color = {note_color}
      \\override MetronomeMark.color = {text_color}
      \\override PageNumber.color = {text_color}
      \\override Arpeggio.color = {note_color}
      \\override Glissando.color = {note_color}
      \\override Glissando.style = #'line
      \\override VoltaBracket.color = {text_color}
      \\override VoltaBracketSpanner.color = {staff_color}
      \\override TupletNumber.color = {note_color}
      \\override TupletBracket.color = {staff_color}
      \\override Slur.color = {note_color}
      \\override PhrasingSlur.color = {note_color}
      \\override Tie.color = {note_color}
      \\override Hairpin.color = {note_color}
      \\override DynamicText.color = {note_color}
      \\override TextScript.color = {text_color}
      \\override Script.color = {note_color}
      \\override Dots.color = {note_color}
    }}
    \\context {{
      \\Staff
      \\RemoveEmptyStaves
    }}
    \\context {{
      \\TabStaff
      \\override StaffSymbol.color = {staff_color}
      \\override TabNoteHead.color = {note_color}
      \\override Clef.color = {note_color}
      \\override BarLine.color = {staff_color}
      \\override TabNoteHead.whiteout = ##f
    }}
    \\context {{
      \\ChordNames
      \\override ChordName.font-name = #"{target_font}"
      \\override ChordName.color = {text_color}
    }}
  }}
}}

\\score {{
  \\unfoldRepeats {{
    {combined_midi_systems}
  }}
  \\midi {{
    \\context {{
      \\Score
      midiChannelMapping = #'instrument
    }}
  }}
}}
"""

def run():
    if not os.path.exists(OUTPUT_FOLDER): 
        os.makedirs(OUTPUT_FOLDER)
        
    if not os.path.exists(INPUT_FOLDER):
        os.makedirs(INPUT_FOLDER)
        print(f"[i] Created missing '{INPUT_FOLDER}' directory.")
        return

    json_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".json")]
    if not json_files:
        print(f"[!] Empty directory: place JSON files inside '{INPUT_FOLDER}/'")
        return

    print(f"[*] Found {len(json_files)} target files. Compiling PDF & MIDI...")
    
    for item in json_files:
        path = os.path.join(INPUT_FOLDER, item)
        base = os.path.splitext(item)[0]
        print(f"[*] Compiling track: '{item}'...")
        
        out_prefix = os.path.join(OUTPUT_FOLDER, base)
        tmp_ly = f"{out_prefix}.ly"
        target_pdf = f"{out_prefix}.pdf"
        target_midi = f"{out_prefix}.midi"

        for old_path in [target_pdf, target_midi, tmp_ly]:
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                file_data = json.load(f)

            ly_content = build_score_syntax(file_data)
            
            with open(tmp_ly, "w", encoding="utf-8") as out:
                out.write(ly_content)
                
            result = subprocess.run(
                [LILYPOND_EXE, f"--output={out_prefix}", tmp_ly],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print(f"    [+] Success! Generated sheet: {target_pdf}")
            else:
                print(f"    [X] LilyPond compilation failed for '{base}':")
                print(result.stderr)

        except Exception as e:
            print(f"    [X] Error processing '{item}': {e}")
            
        finally:
            if os.path.exists(tmp_ly):
                try:
                    os.remove(tmp_ly)
                except Exception:
                    pass    
        
if __name__ == "__main__":
    run()