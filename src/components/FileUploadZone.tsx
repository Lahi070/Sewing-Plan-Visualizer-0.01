'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploadZoneProps {
  stepNumber: number;
  title: string;
  subtitle: string;
  fileType: 'sewing' | 'knitting' | 'trims';
  lastUploadedAt?: string;
  lastFileName?: string;
  lastSheetUsed?: string;
  onFileParsed: (parsedData: {
    fileName: string;
    workbook: XLSX.WorkBook;
    fileType: 'sewing' | 'knitting' | 'trims';
  }) => void;
  isLoading?: boolean;
}

export function FileUploadZone({
  stepNumber,
  title,
  subtitle,
  fileType,
  lastUploadedAt,
  lastFileName,
  lastSheetUsed,
  onFileParsed,
  isLoading = false,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setErrorMsg(null);
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg('Please upload an Excel (.xlsx or .xls) spreadsheet.');
      return;
    }

    try {
      setSelectedFileName(file.name);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      onFileParsed({
        fileName: file.name,
        workbook,
        fileType,
      });
    } catch (err: any) {
      setErrorMsg(`Failed to parse Excel file: ${err.message || 'Invalid format'}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="bg-gradient-to-br from-navy-850 to-navy-900 rounded-3xl border border-navy-700/80 p-5 sm:p-6 shadow-xl shadow-navy-950/40 flex flex-col justify-between backdrop-blur-md">
      <div>
        {/* Step Badge & Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-navy-800 border border-blue-400/30 text-white text-xs font-extrabold flex items-center justify-center shadow-md">
              {stepNumber}
            </span>
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          {lastUploadedAt && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              <span>Active</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4">{subtitle}</p>

        {/* Dropzone Box */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-950/40 scale-[1.01] shadow-cyan-glow'
              : selectedFileName
              ? 'border-emerald-500/50 bg-emerald-950/20'
              : 'border-navy-700/80 hover:border-cyan-500/60 bg-navy-950/60 hover:bg-navy-900/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedFileName
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-navy-800 text-cyan-400 border border-navy-700'
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              ) : selectedFileName ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-200">
                {selectedFileName ? selectedFileName : 'Drag & drop Excel file here'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                or click to browse (.xlsx, .xls)
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-start space-x-2 text-xs text-rose-300 bg-rose-950/80 p-2.5 rounded-xl border border-rose-500/40">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Metadata Info Footer */}
      {(lastFileName || lastUploadedAt || lastSheetUsed) && (
        <div className="mt-4 pt-3 border-t border-navy-700/60 text-[11px] text-slate-400 space-y-0.5">
          {lastFileName && (
            <div className="flex justify-between">
              <span>Current file:</span>
              <span className="font-semibold text-slate-200 truncate max-w-[170px]">{lastFileName}</span>
            </div>
          )}
          {lastSheetUsed && (
            <div className="flex justify-between">
              <span>Sheet parsed:</span>
              <span className="font-mono font-medium text-cyan-300">{lastSheetUsed}</span>
            </div>
          )}
          {lastUploadedAt && (
            <div className="flex justify-between">
              <span>Last uploaded:</span>
              <span className="font-medium text-slate-400">
                {new Date(lastUploadedAt).toLocaleDateString()} {new Date(lastUploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
