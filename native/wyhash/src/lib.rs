use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wyhash(input: &[u8], seed: u64) -> u64 {
    wyhash::wyhash(input, seed)
}
