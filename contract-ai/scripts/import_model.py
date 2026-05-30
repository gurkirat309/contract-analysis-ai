#!/usr/bin/env python3
"""
Model Import & Reassembly Script for Contract Analysis AI.
This script automates importing your trained model from Google Colab into the local workspace.
It supports:
1. Reassembling model chunks (chunk_000.bin, etc.) if downloaded via Colab's split download.
2. Extracting contract_classifier.zip and copying required label maps.
3. Verifying that the imported model directory is structurally sound.
"""

import os
import shutil
import zipfile
import re
import argparse
from pathlib import Path

# Resolve project directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PROJECT_ROOT / "models"
MODEL_TARGET_DIR = MODELS_DIR / "contract_classifier"
LABEL_MAP_TARGET = MODELS_DIR / "label_map.json"

REQUIRED_FILES = [
    "model.safetensors",
    "config.json",
    "label_map.json",
    "tokenizer.json",
    "tokenizer_config.json"
]

def reassemble_chunks(dir_path: Path) -> bool:
    """Reassemble split chunk files (chunk_xxx.bin) into model.safetensors."""
    chunk_pattern = re.compile(r"^chunk_(\d+)\.bin$")
    chunk_files = []
    
    for item in os.listdir(dir_path):
        match = chunk_pattern.match(item)
        if match:
            chunk_files.append((int(match.group(1)), dir_path / item))
            
    if not chunk_files:
        return False
        
    # Sort by chunk index
    chunk_files.sort(key=lambda x: x[0])
    
    output_file = dir_path / "model.safetensors"
    print(f"\n📦 Found {len(chunk_files)} model chunks inside {dir_path.relative_to(PROJECT_ROOT)}.")
    print(f"🔗 Reassembling into {output_file.relative_to(PROJECT_ROOT)}...")
    
    try:
        with open(output_file, 'wb') as outfile:
            for index, chunk_path in chunk_files:
                print(f"   -> Processing chunk {index:03d} ({chunk_path.name})...")
                with open(chunk_path, 'rb') as infile:
                    shutil.copyfileobj(infile, outfile)
        
        # Clean up chunk files after successful merge
        print("🗑️  Cleaning up chunk files to save disk space...")
        for _, chunk_path in chunk_files:
            os.remove(chunk_path)
            
        print("✅ Reassembly complete!")
        return True
    except Exception as e:
        print(f"❌ Error reassembling chunks: {e}")
        return False

def extract_zip(zip_path: Path) -> bool:
    """Extract a downloaded model zip into the target classifier directory."""
    print(f"\n📂 Found zip archive at: {zip_path.name}")
    print(f"📦 Extracting to {MODEL_TARGET_DIR.relative_to(PROJECT_ROOT)}...")
    
    MODEL_TARGET_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Zip files might have a root folder or contain files directly.
            # We want to extract files directly into MODEL_TARGET_DIR.
            # Inspect first:
            namelist = zip_ref.namelist()
            
            # Check if all files are inside a nested "contract_classifier/" folder in the zip
            has_nested_dir = all(name.startswith("contract_classifier/") for name in namelist if name != "contract_classifier/")
            
            for file_info in zip_ref.infolist():
                if file_info.is_dir():
                    continue
                    
                filename = file_info.filename
                if has_nested_dir:
                    # Strip the nested folder prefix
                    target_name = filename.replace("contract_classifier/", "", 1)
                else:
                    target_name = filename
                
                # Safeguard path traversal
                target_path = (MODEL_TARGET_DIR / target_name).resolve()
                if not str(target_path).startswith(str(MODEL_TARGET_DIR.resolve())):
                    continue
                    
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zip_ref.open(file_info) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                    
        print("✅ Extraction complete!")
        return True
    except Exception as e:
        print(f"❌ Error extracting zip: {e}")
        return False

def verify_and_setup_labels() -> bool:
    """Ensure label_map.json is copied correctly and all files exist."""
    print("\n🔍 Verifying imported files...")
    
    # 1. Check if files exist
    missing = []
    for filename in REQUIRED_FILES:
        file_path = MODEL_TARGET_DIR / filename
        if not file_path.exists():
            missing.append(filename)
            
    if missing:
        print("⚠️  The following expected files are missing from the model directory:")
        for m in missing:
            print(f"   - {m}")
        return False
        
    print("✅ All required model and tokenizer files found!")
    
    # 2. Sync label_map.json to root models/ directory
    source_label_map = MODEL_TARGET_DIR / "label_map.json"
    try:
        shutil.copy(source_label_map, LABEL_MAP_TARGET)
        print(f"📋 Copied label_map.json to {LABEL_MAP_TARGET.relative_to(PROJECT_ROOT)}")
        return True
    except Exception as e:
        print(f"❌ Error copying label map: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Import fine-tuned DistilBERT models from Google Colab.")
    parser.add_argument("--zip", type=str, help="Path to contract_classifier.zip if located elsewhere")
    args = parser.parse_args()
    
    # Ensure models directories exist
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_TARGET_DIR.mkdir(parents=True, exist_ok=True)
    
    zip_source = None
    
    # Locate Zip file
    if args.zip:
        zip_source = Path(args.zip)
    else:
        # Check root folder first, then models folder
        potential_zips = [
            PROJECT_ROOT / "contract_classifier.zip",
            MODELS_DIR / "contract_classifier.zip"
        ]
        for pz in potential_zips:
            if pz.exists():
                zip_source = pz
                break
                
    # If zip is found, extract it
    if zip_source and zip_source.exists():
        if extract_zip(zip_source):
            # Optional: rename zip to avoid re-extracting next time or just let it be
            pass
            
    # Check if there are chunk files in target directory and reassemble
    reassembled = reassemble_chunks(MODEL_TARGET_DIR)
    
    # Validate final structure
    success = verify_and_setup_labels()
    
    if success:
        print("\n🎉 SUCCESS: Your model is fully imported and ready to run!")
        print("💡 Run the server with: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload\n")
    else:
        print("\n❌ IMPORT INCOMPLETE: Please ensure you have downloaded all files from Google Colab.")
        print(f"👉 Recommended structure in {MODEL_TARGET_DIR.relative_to(PROJECT_ROOT)}:")
        for r in REQUIRED_FILES:
            print(f"   - {r}")
        print("")

if __name__ == "__main__":
    main()
