import { useState, useEffect } from 'react';
import { FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import apiService from '../services/api';
import './DataSensor.css';

const DataSensor = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // ✅ Tách riêng input để chỉ search khi Enter
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [sensorData, setSensorData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10); // ✅ Có thể thay đổi page size
  const [orderBy, setOrderBy] = useState('timestamp'); // ✅ Cột đang sắp xếp
  const [orderDir, setOrderDir] = useState('DESC'); // ✅ Hướng sắp xếp
  const [sortState, setSortState] = useState({}); // ✅ Track trạng thái sort của từng cột

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  // Fetch data from backend (with search, filter, sorting)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await apiService.getSensors(
        currentPage, 
        itemsPerPage, 
        searchTerm, 
        filterType,
        orderBy,
        orderDir
      );
      
      if (result && result.data) {
        // ✅ Backend đã group sẵn, chỉ format lại
        const formatted = result.data.map(item => ({
          id: item.id,
          temperature: item.temperature != null ? item.temperature.toFixed(1) : '-',
          humidity: item.humidity != null ? item.humidity.toFixed(1) : '-',
          light: item.light != null ? item.light.toFixed(0) : '-',
          time: new Date(item.timestamp).toLocaleString('vi-VN'),
          rawTimestamp: item.timestamp // ✅ Giữ timestamp gốc để copy
        }));

        setSensorData(formatted);
        setTotalRecords(result.total || 0);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchTerm, filterType, orderBy, orderDir]);

  // ✅ XỬ LÝ SẮP XẾP (BACKEND SORTING theo yêu cầu thầy)
  // Ấn lần 1: ASC, Ấn lần 2: DESC, Ấn lần 3: về mặc định (timestamp DESC)
  const handleSort = (column) => {
    const currentState = sortState[column] || 'none';
    let newState, newOrderBy, newOrderDir;

    if (currentState === 'none') {
      newState = 'asc';
      newOrderBy = column;
      newOrderDir = 'ASC';
    } else if (currentState === 'asc') {
      newState = 'desc';
      newOrderBy = column;
      newOrderDir = 'DESC';
    } else {
      // Reset về mặc định
      newState = 'none';
      newOrderBy = 'timestamp';
      newOrderDir = 'DESC';
    }

    setSortState({ [column]: newState }); // Reset các cột khác
    setOrderBy(newOrderBy);
    setOrderDir(newOrderDir);
    setCurrentPage(1); // Reset về page 1
  };

  // ✅ CLICK TO COPY TIME
  const handleCopyTime = (timestamp) => {
    navigator.clipboard.writeText(timestamp).then(() => {
      // Visual feedback (có thể thêm toast notification)
      console.log('✅ Copied:', timestamp);
    });
  };

  // ✅ XỬ LÝ SEARCH
  const handleSearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  // ✅ ENTER KEY HANDLER
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="data-sensor">
      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Search (ID,Temperature,Humidity,Light,Time) - Press Enter"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option>All</option>
          <option>Temperature</option>
          <option>Humidity</option>
          <option>Light</option>
        </select>
        <button 
          className="search-btn"
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#00b4d8' }}>
            Loading...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                  ID {sortState['id'] === 'asc' ? '↑' : sortState['id'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('temperature')} style={{ cursor: 'pointer' }}>
                  Temperature(°C) {sortState['temperature'] === 'asc' ? '↑' : sortState['temperature'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('humidity')} style={{ cursor: 'pointer' }}>
                  Humidity(%) {sortState['humidity'] === 'asc' ? '↑' : sortState['humidity'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('light')} style={{ cursor: 'pointer' }}>
                  Light(nits) {sortState['light'] === 'asc' ? '↑' : sortState['light'] === 'desc' ? '↓' : ''}
                </th>
                <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                  Time {sortState['timestamp'] === 'asc' ? '↑' : sortState['timestamp'] === 'desc' ? '↓' : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sensorData.length > 0 ? (
                <>
                  {sensorData.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                      <td>{row.id}</td>
                      <td>{row.temperature}</td>
                      <td>{row.humidity}</td>
                      <td>{row.light}</td>
                      <td 
                        onClick={() => handleCopyTime(row.time)}
                        style={{ cursor: 'pointer' }}
                        title="Click to copy"
                      >
                        {row.time}
                      </td>
                    </tr>
                  ))}
                  {/* ✅ Fill empty rows để luôn đủ pageSize */}
                  {[...Array(Math.max(0, itemsPerPage - sensorData.length))].map((_, index) => (
                    <tr key={`empty-${index}`} className={(sensorData.length + index) % 2 === 0 ? 'even' : 'odd'}>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No data available
                    </td>
                  </tr>
                  {/* ✅ Fill empty rows */}
                  {[...Array(itemsPerPage - 1)].map((_, index) => (
                    <tr key={`empty-${index}`} className={(index + 1) % 2 === 0 ? 'even' : 'odd'}>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <FaChevronLeft />
        </button>

        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        ))}

        <button
          className="page-btn arrow"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          <FaChevronRight />
        </button>

        <select 
          className="page-size-select"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          style={{ 
            marginLeft: '6px',
            padding: '3px 6px',
            borderRadius: '4px',
            border: '1px solid #00b4d8',
            background: '#1e2536',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          <option value={5}>5/page</option>
          <option value={10}>10/page</option>
          <option value={15}>15/page</option>
          <option value={20}>20/page</option>
        </select>
      </div>
    </div>
  );
};

export default DataSensor;