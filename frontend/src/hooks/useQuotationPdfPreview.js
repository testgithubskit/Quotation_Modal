import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import {
  downloadQuotationPdfViaChromium,
  fetchQuotationPdfObjectUrl,
  revokeQuotationPdfObjectUrl,
} from '../utils/renderQuotationReport.js';
import { getApiErrorMessage } from '../config/auth.js';

export default function useQuotationPdfPreview() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const ctxRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setCtx(null);
    ctxRef.current = null;
    setPdfUrl((prev) => {
      revokeQuotationPdfObjectUrl(prev);
      return null;
    });
  }, []);

  const openPreview = useCallback(async (previewCtx) => {
    setCtx(previewCtx);
    ctxRef.current = previewCtx;
    setOpen(true);
    setLoading(true);
    setPdfUrl((prev) => {
      revokeQuotationPdfObjectUrl(prev);
      return null;
    });
    try {
      const url = await fetchQuotationPdfObjectUrl(previewCtx);
      setPdfUrl(url);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load PDF preview'));
      close();
    } finally {
      setLoading(false);
    }
  }, [close]);

  const download = useCallback(async () => {
    const current = ctxRef.current;
    if (!current) return;
    setDownloadLoading(true);
    try {
      await downloadQuotationPdfViaChromium(current);
      message.success('PDF downloaded');
    } catch (error) {
      message.error(error?.message || getApiErrorMessage(error, 'PDF download failed'));
    } finally {
      setDownloadLoading(false);
    }
  }, []);

  useEffect(() => () => revokeQuotationPdfObjectUrl(pdfUrl), [pdfUrl]);

  return {
    open,
    loading,
    pdfUrl,
    ctx,
    close,
    openPreview,
    download,
    downloadLoading,
  };
}
