import os
import requests
import numpy as np
import datetime
import argparse
import sys

def download_data(year, var, url_endpoint, param_name, out_dir="data"):
    """
    Downloads raw binary IMD gridded file (.grd) from IMD Pune.
    """
    os.makedirs(out_dir, exist_ok=True)
    filename = os.path.join(out_dir, f"{var}_{year}.grd")
    if os.path.exists(filename):
        print(f"{filename} already exists. Skipping download.")
        return filename
    
    print(f"Downloading {var} for {year}...")
    try:
        response = requests.post(url_endpoint, data={param_name: str(year)}, stream=True, timeout=60)
        response.raise_for_status()
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print(f"Saved {filename}")
        return filename
    except Exception as e:
        print(f"Failed to download {var} for {year}: {e}")
        return None

def parse_grd(filename, isiz, jsiz, year):
    """
    Parses Fortran unformatted binary grid file (.grd).
    Replaces undefined flags (-999.0, 99.9) with NaN.
    """
    ndays = 366 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 365
    
    try:
        data = np.fromfile(filename, dtype='float32')
        expected_size = ndays * isiz * jsiz
        if len(data) == expected_size:
            data = data.reshape((ndays, isiz, jsiz))
        elif len(data) == ndays * (isiz * jsiz + 2):
            data = data.reshape((ndays, isiz * jsiz + 2))
            data = data[:, 1:-1].reshape((ndays, isiz, jsiz))
        else:
            print(f"Warning: Unexpected data size for {filename}. Size: {len(data)}, Expected: {expected_size}")
            if len(data) >= expected_size:
                data = data[:expected_size].reshape((ndays, isiz, jsiz))
            else:
                raise ValueError("Data file too small")
        
        # Replace UNDEF values
        data[data == -999.0] = np.nan
        data[data == 99.9] = np.nan
        return data
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return np.zeros((ndays, isiz, jsiz)) * np.nan

def resample_rain_to_temp_grid(rain_arr):
    """
    Downsamples Rainfall grid (135x129, 0.25 deg) to match Temperature grid (31x31, 1.0 deg)
    using 4x4 spatial block averaging.
    """
    T = rain_arr.shape[0]
    rain_resized = np.full((T, 31, 31), np.nan, dtype=np.float32)
    for r in range(31):
        for c in range(31):
            r_start = 4 + r * 4
            c_start = 4 + c * 4
            block = rain_arr[:, r_start:r_start+4, c_start:c_start+4]
            rain_resized[:, c, r] = np.nanmean(block, axis=(1, 2))
    return rain_resized

def main():
    parser = argparse.ArgumentParser(description="IMD Gridded Data Pipeline")
    parser.add_argument("--start", type=int, default=2022)
    parser.add_argument("--end", type=int, default=2023)
    parser.add_argument("--data_dir", type=str, default="data")
    args = parser.parse_args()

    urls = {
        'rain': ('https://www.imdpune.gov.in/cmpg/Griddata/rainfall.php', 'rain', 135, 129),
        'max': ('https://www.imdpune.gov.in/cmpg/Griddata/maxtemp.php', 'maxtemp', 31, 31),
        'min': ('https://www.imdpune.gov.in/cmpg/Griddata/mintemp.php', 'mintemp', 31, 31)
    }

    out_dir = args.data_dir
    os.makedirs(out_dir, exist_ok=True)

    for year in range(args.start, args.end + 1):
        year_data = {}
        for var, (url, param, isiz, jsiz) in urls.items():
            filename = download_data(year, var, url, param, out_dir=out_dir)
            if filename and os.path.exists(filename):
                arr = parse_grd(filename, isiz, jsiz, year)
                year_data[var] = arr
            else:
                print(f"Skipping {var} for {year} due to download failure or file missing.")
        
        if 'rain' in year_data and 'max' in year_data:
            year_data['rain'] = resample_rain_to_temp_grid(year_data['rain'])
        
        if all(k in year_data for k in ['rain', 'max', 'min']):
            # Stack along channels: 0=rain, 1=max, 2=min -> Shape: (Days, 3, 31, 31)
            combined = np.stack([year_data['rain'], year_data['max'], year_data['min']], axis=1)
            output_npy = os.path.join(out_dir, f"weather_{year}.npy")
            np.save(output_npy, combined)
            print(f"Saved aggregated data for {year} shape: {combined.shape} to {output_npy}")
        else:
            print(f"Incomplete data for {year}. Skipping aggregation.")

if __name__ == "__main__":
    main()
