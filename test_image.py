#!/usr/bin/env python3
"""
Create a test image for upload testing
"""

from PIL import Image, ImageDraw, ImageFont
import base64
import io

def create_test_discharge_summary():
    """Create a test discharge summary image"""
    # Create a white background image
    width, height = 800, 600
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw hospital header
    draw.text((50, 30), "GENERAL HOSPITAL", fill='black', font=font_large)
    draw.text((50, 60), "DISCHARGE SUMMARY", fill='black', font=font_medium)
    
    # Patient details
    y_pos = 120
    draw.text((50, y_pos), "Patient: Margaret Thompson", fill='black', font=font_medium)
    y_pos += 30
    draw.text((50, y_pos), "DOB: 15/03/1947", fill='black', font=font_small)
    y_pos += 25
    draw.text((50, y_pos), "Discharge Date: 01/02/2026", fill='black', font=font_small)
    
    # Diagnosis
    y_pos += 40
    draw.text((50, y_pos), "DIAGNOSIS:", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "Chest pain - investigation. Cardiac enzymes normal.", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "Discharged with stable angina management.", fill='black', font=font_small)
    
    # Medications
    y_pos += 40
    draw.text((50, y_pos), "MEDICATIONS:", fill='black', font=font_medium)
    y_pos += 25
    medications = [
        "1. Aspirin 100mg daily",
        "2. Metformin 500mg twice daily", 
        "3. Lisinopril 10mg daily",
        "4. Atorvastatin 20mg nightly (NEW)"
    ]
    
    for med in medications:
        draw.text((50, y_pos), med, fill='black', font=font_small)
        y_pos += 20
    
    # Instructions
    y_pos += 30
    draw.text((50, y_pos), "DISCHARGE INSTRUCTIONS:", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "Continue current medications. New statin added for", fill='black', font=font_small)
    y_pos += 20
    draw.text((50, y_pos), "cholesterol management. Low-salt diet.", fill='black', font=font_small)
    
    # Follow-up
    y_pos += 30
    draw.text((50, y_pos), "FOLLOW-UP:", fill='black', font=font_medium)
    y_pos += 25
    draw.text((50, y_pos), "GP review in 2 weeks. Pathology for HbA1c in 4 weeks.", fill='black', font=font_small)
    
    return image

def save_test_image():
    """Save test image as base64 and file"""
    image = create_test_discharge_summary()
    
    # Save as file
    image.save('/app/test_discharge_summary.jpg', 'JPEG', quality=85)
    
    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=85)
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    print("Test discharge summary image created:")
    print(f"File: /app/test_discharge_summary.jpg")
    print(f"Base64 length: {len(image_base64)} characters")
    
    return image_base64

if __name__ == "__main__":
    save_test_image()